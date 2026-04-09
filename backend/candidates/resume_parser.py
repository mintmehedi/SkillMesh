from datetime import datetime
from io import BytesIO

from docx import Document
from pypdf import PdfReader


COMMON_SKILLS = [
    "python",
    "java",
    "javascript",
    "react",
    "django",
    "sql",
    "postgresql",
    "machine learning",
    "aws",
    "docker",
]


def extract_text_from_upload(uploaded_file):
    name = uploaded_file.name.lower()
    content = uploaded_file.read()
    uploaded_file.seek(0)
    if name.endswith(".pdf"):
        reader = PdfReader(BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    if name.endswith(".docx"):
        doc = Document(BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)
    return content.decode("utf-8", errors="ignore")


def parse_resume_text(raw_text):
    lowered = raw_text.lower()
    matched_skills = [s for s in COMMON_SKILLS if s in lowered]
    education_level = "bachelor" if "bachelor" in lowered else ("master" if "master" in lowered else "")
    years_experience = 0
    for n in range(15, 0, -1):
        token = f"{n} year"
        if token in lowered:
            years_experience = n
            break
    return {
        "skills": matched_skills,
        "education_level": education_level,
        "years_experience": years_experience,
        "parsed_at": datetime.utcnow().isoformat(),
    }
