import json
import os
import tempfile
from typing import List, Literal, Tuple
from uuid import UUID

import boto3
import pymupdf
import whisper
from fastapi import HTTPException
from langchain_text_splitters import RecursiveCharacterTextSplitter
from mypy_boto3_bedrock_runtime.client import BedrockRuntimeClient
from sqlalchemy import asc, select
from sqlalchemy.orm import Session

from src.db.tables import Chunk, Document, KnowledgeBase
from src.dto import DocumentCreateDTO, MessageDTO


class RAGHandler:
    def __init__(self):
        self.client: BedrockRuntimeClient = boto3.client(
            "bedrock-runtime", region_name="us-east-2"
        )

        self.ocr_model_id = "us.anthropic.claude-sonnet-4-20250514-v1:0"

        self.extraction_fn_mapping = {
            "txt": self.extract_text_from_txt,
            "pdf": self.extract_text_from_pdf,
            "png": lambda data: self.extract_text_from_image(data, extension="png"),
            "jpeg": lambda data: self.extract_text_from_image(data, extension="jpeg"),
            "jpg": lambda data: self.extract_text_from_image(data, extension="jpeg"),
            "mp4": lambda data: self.extract_text_from_video(data),
            "json": self.extract_text_from_txt,
        }

        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, chunk_overlap=200
        )

        self.whisper_model = None

    def add_document(
        self,
        knowledge_base: KnowledgeBase,
        document_dto: DocumentCreateDTO,
        session: Session,
    ) -> Document:
        """Add a document to the knowledge base and process its chunks.

        Args:
            knowledge_base (KnowledgeBase): The knowledge base to add the document to.
            document_dto (DocumentCreateDTO): The document data transfer object containing document details.
            session (Session): The database session to use for operations.

        Returns:
            Document: The newly added document.
        """
        new_document = Document(
            knowledge_base_id=knowledge_base.id,
            document_type=document_dto.document_type,
            document_extension=document_dto.document_extension,
            name=document_dto.name,
            data=document_dto.data,
        )

        session.add(new_document)
        session.flush()

        self.process_document_chunks(new_document, session)

        session.commit()

        return new_document

    def process_document_chunks(self, document: Document, session: Session) -> Document:
        """Process the document to extract text, split into chunks, generate embeddings, and store them.

        Provides support for txt, pdf, png, jpeg, json and mp4 document types.

        Args:
            document (Document): The document to process.
            session (Session): The database session to use for operations.

        Raises:
            HTTPException: If the document type is unsupported.

        Returns:
            Document: The processed document.
        """
        extraction_fn = self.extraction_fn_mapping.get(
            document.document_extension, None
        )

        if not extraction_fn:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported document type: {document.document_extension}",
            )

        data = document.data
        extracted_text = extraction_fn(data)
        text_chunks = self.text_splitter.split_text(extracted_text)

        if not text_chunks or len(text_chunks) == 0:
            return document

        embeddings = self.get_embeddings(
            texts=text_chunks, input_type="search_document"
        )

        chunks = [
            Chunk(
                document_id=document.id,
                content=text_chunk,
                embedding=embedding,
                index=i,
            )
            for i, (text_chunk, embedding) in enumerate(zip(text_chunks, embeddings))
        ]

        session.add_all(chunks)
        session.flush()

        return document

    def get_embeddings(
        self,
        texts: List[str],
        input_type: Literal["search_document", "search_query"] = "search_document",
    ) -> List[List[float]]:
        """Generate embeddings for the given texts using Bedrock's Cohere embed-v4 model.

        Args:
            texts (List[str]): The texts to generate embeddings for.
            input_type (Literal["search_document", "search_query"], optional): The type of input. Defaults to "search_document".

        Raises:
            HTTPException: If embeddings cannot be retrieved from Bedrock.

        Returns:
            List[List[float]]: A list of embeddings corresponding to the input texts.
        """
        model_id = "us.cohere.embed-v4:0"
        accept = "*/*"
        content_type = "application/json"

        response = self.client.invoke_model(
            modelId=model_id,
            accept=accept,
            contentType=content_type,
            body=json.dumps({"texts": texts, "input_type": input_type}),
        )

        response_body = json.loads(response.get("body").read())
        embeddings = response_body.get("embeddings", None)

        if embeddings is None:
            raise HTTPException(
                status_code=500,
                detail="Failed to retrieve embeddings from Bedrock.",
            )

        for embedding_type in embeddings:
            return embeddings[embedding_type]

    def extract_text_from_txt(self, data: bytes) -> str:
        """Extract text from a TXT file.

        Args:
            data (bytes): The byte content of the TXT file.

        Returns:
            str: The extracted text.
        """
        return data.decode("utf-8")

    def extract_text_from_pdf(self, data: bytes) -> str:
        """Extract text from a PDF file, including text from embedded images using OCR.

        Args:
            data (bytes): The byte content of the PDF file.

        Returns:
            str: The extracted text.
        """
        document = pymupdf.open(stream=data, filetype="pdf")
        text = ""

        for page_num in range(document.page_count):
            page = document.load_page(page_num)
            text += page.get_text()

            for img in page.get_images(full=True):
                xref = img[0]
                base_image = page.parent.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]

                if image_ext == "jpg":
                    image_ext = "jpeg"

                if image_ext not in ["png", "jpeg"]:
                    continue

                image_text = self.extract_text_from_image(
                    data=image_bytes, extension=image_ext
                )

                text += image_text

        return text

    def extract_text_from_image(
        self, data: bytes, extension: Literal["png", "jpeg"]
    ) -> str:
        """Extract text from an image using an OCR model via Bedrock.

        Args:
            data (bytes): The byte content of the image.
            extension (Literal["png", "jpeg"]): The format of the image.

        Raises:
            HTTPException: If an error occurs during OCR extraction.

        Returns:
            str: The extracted text or a description of the image if no text is found.
        """
        try:
            response = self.client.converse(
                modelId=self.ocr_model_id,
                system=[
                    {
                        "text": "You are an OCR model that extracts text from images accurately. Return EITHER the extracted text OR a description of the image if no text is found.",
                    }
                ],
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "image": {
                                    "source": {"bytes": data},
                                    "format": extension,
                                }
                            }
                        ],
                    }
                ],
            )
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Error during OCR extraction: {str(e)}"
            )

        return response["output"]["message"]["content"][0]["text"]

    def extract_text_from_video(self, data: bytes) -> str:
        """Extract text from a video file using the Whisper model.

        Will load the Whisper model if it hasn't been loaded yet.

        Args:
            data (bytes): The byte content of the video file.

        Raises:
            HTTPException: If an error occurs during Whisper transcription.

        Returns:
            str: _description_
        """
        if self.whisper_model is None:
            self.whisper_model = whisper.load_model("base")
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_video:
            temp_video.write(data)
            temp_video_path = temp_video.name

        try:
            result = self.whisper_model.transcribe(
                temp_video_path,
                language="pt",
                fp16=False,
            )

            extracted_text = result["text"]
        except Exception as e:
            os.remove(temp_video_path)
            raise HTTPException(
                status_code=500,
                detail=f"Error during Whisper transcription: {str(e)}",
            )

        os.remove(temp_video_path)
        return extracted_text

    def query(
        self,
        session: Session,
        knowledge_base: KnowledgeBase,
        message: MessageDTO,
        k: int = 3,
        similarity_threshold: float = 0.0,
        preferred_type: str | None = None,
    ) -> Tuple[List[UUID], str] | Tuple[None, None]:
        """Query the knowledge base for relevant document chunks based on the input message.

        Args:
            session (Session): Database session for executing queries.
            knowledge_base (KnowledgeBase): The knowledge base to query against.
            message (MessageDTO): The message containing the query content.
            k (int, optional): The number of results to return. Defaults to 3.
            similarity_threshold (float, optional): The minimum similarity score for results. Defaults to 0.0.
            preferred_type (str | None, optional): The preferred document type to filter results. Defaults to None.

        Returns:
            Tuple[List[UUID], str] | Tuple[None, None]: A tuple containing a list of referenced document IDs and the context string, or (None, None) if no relevant chunks are found.
        """
        query_embedding = self.get_embeddings(
            texts=[message.content.text], input_type="search_query"
        )[0]

        distance_function = Chunk.embedding.cosine_distance(query_embedding)

        statement = (
            select(
                Chunk,
                distance_function.label("distance"),
            )
            .join(Document, Chunk.document_id == Document.id)
            .filter(Document.knowledge_base_id == knowledge_base.id)
            .order_by(asc("distance"))
            .limit(k)
        )

        if preferred_type:
            statement = statement.filter(Document.document_type == preferred_type)

        results = session.execute(statement).all()

        referenced_documents = []
        context_chunks_content = []

        for row in results:
            chunk_obj = row.Chunk
            distance = row.distance

            similarity = 1 - distance

            if similarity >= similarity_threshold:
                referenced_documents.append(chunk_obj.document_id)
                context_chunks_content.append(
                    f"----\nDOCUMENT_ID: {chunk_obj.document_id}\nSIMILARITY: {similarity}\nCONTENT: {chunk_obj.content}",
                )

        if not context_chunks_content:
            return None, None

        return (
            referenced_documents,
            (
                "[RAG CONTEXT START]\n"
                + "\n\n---\n\n".join(context_chunks_content)
                + "\n[RAG CONTEXT END]"
            ),
        )
