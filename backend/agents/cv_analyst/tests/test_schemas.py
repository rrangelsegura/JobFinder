import pytest

from agents.cv_analyst.schemas import (
    CertificationEntry,
    CvExtractionResult,
    EducationEntry,
    LanguageEntry,
    PersonalInfo,
    ProjectEntry,
    SkillEntry,
    SkillType,
    WorkExperienceEntry,
)


# Spec (cv-extraction): "CV with all field groups present extracts all groups"
def test_extraction_result_accepts_all_six_field_groups_populated():
    result = CvExtractionResult(
        personal_info=PersonalInfo(first_name="Ada", last_name="Lovelace", email="ada@example.com"),
        education=[EducationEntry(institution="Cambridge", title="Mathematics", start_date="1840-01-01")],
        work_experience=[
            WorkExperienceEntry(company="Analytical Engines Ltd", position="Analyst", start_date="1842-01-01")
        ],
        skills=[SkillEntry(name="Python", type=SkillType.technical)],
        languages=[LanguageEntry(name="English", proficiency="native")],
        certifications=[CertificationEntry(name="PMP", issuer="PMI")],
    )

    assert result.personal_info.first_name == "Ada"
    assert len(result.education) == 1
    assert len(result.work_experience) == 1
    assert len(result.skills) == 1
    assert len(result.languages) == 1
    assert len(result.certifications) == 1


# Spec (cv-extraction): "CV missing optional field groups still succeeds"
def test_extraction_result_succeeds_with_only_mandatory_groups_populated():
    result = CvExtractionResult(
        personal_info=PersonalInfo(first_name="Ada", last_name="Lovelace", email="ada@example.com"),
        education=[EducationEntry(institution="Cambridge", title="Mathematics", start_date="1840-01-01")],
        work_experience=[
            WorkExperienceEntry(company="Analytical Engines Ltd", position="Analyst", start_date="1842-01-01")
        ],
        # skills, languages, certifications intentionally omitted
    )

    assert result.skills == []
    assert result.languages == []
    assert result.certifications == []


# Found via manual end-to-end testing (task group 12): a real LLM call
# faithfully copied "present" from the resume text for an ongoing job's
# end_date, which a plain Optional[date] field rejected outright.
@pytest.mark.parametrize("token", ["present", "Present", "current", "CURRENTLY", "ongoing", "now", "n/a", "-"])
def test_work_experience_end_date_treats_ongoing_tokens_as_none(token):
    entry = WorkExperienceEntry(company="Acme", position="Engineer", start_date="2020-01-01", end_date=token)
    assert entry.end_date is None


def test_education_end_date_treats_ongoing_tokens_as_none():
    entry = EducationEntry(institution="MIT", title="CS", start_date="2020-01-01", end_date="present")
    assert entry.end_date is None


def test_end_date_still_rejects_genuinely_invalid_values():
    with pytest.raises(ValueError):
        WorkExperienceEntry(company="Acme", position="Engineer", start_date="2020-01-01", end_date="not a date")


# cv-upload-hardening: found via a real 5-page CV re-tested after fixing the
# long-list and retry-context bugs — the LLM faithfully reported dates as
# "YYYY-MM" (month + year only, no day, matching how the resume itself
# states dates) for a start_date, which the required `date` field rejected
# outright, on both the first attempt and the retry.
@pytest.mark.parametrize("field", ["start_date", "end_date"])
def test_work_experience_accepts_year_month_only_dates(field):
    kwargs = {"company": "Acme", "position": "Engineer", "start_date": "2020-01"}
    kwargs[field] = "2020-06"
    entry = WorkExperienceEntry(**kwargs)
    assert getattr(entry, field).day == 1


def test_education_start_date_accepts_year_month_only():
    entry = EducationEntry(institution="MIT", title="CS", start_date="2015-09")
    assert entry.start_date.isoformat() == "2015-09-01"


def test_certification_issue_date_accepts_year_month_only():
    entry = CertificationEntry(name="PMP", issue_date="2021-03")
    assert entry.issue_date.isoformat() == "2021-03-01"


def test_start_date_still_rejects_genuinely_invalid_values():
    with pytest.raises(ValueError):
        WorkExperienceEntry(company="Acme", position="Engineer", start_date="not a date")


# work-experience-detail: responsibilities/projects give the LLM somewhere
# structured to put role-level duties and specific initiatives, instead of
# collapsing everything into `description` (which came back empty on a real
# CV — see cv-upload-hardening's manual verification).
def test_work_experience_accepts_responsibilities_and_projects():
    entry = WorkExperienceEntry(
        company="Acme",
        position="Engineer",
        start_date="2020-01-01",
        responsibilities=["Led backend architecture", "Mentored junior engineers"],
        projects=[
            ProjectEntry(
                name="Checkout Revamp",
                description="Rebuilt the checkout flow",
                achievements=["Cut cart abandonment by 15%"],
                stack=["Python", "PostgreSQL"],
            )
        ],
    )
    assert entry.responsibilities == ["Led backend architecture", "Mentored junior engineers"]
    assert len(entry.projects) == 1
    assert entry.projects[0].name == "Checkout Revamp"


def test_work_experience_responsibilities_and_projects_default_to_empty_lists():
    entry = WorkExperienceEntry(company="Acme", position="Engineer", start_date="2020-01-01")
    assert entry.responsibilities == []
    assert entry.projects == []


def test_project_entry_requires_only_name():
    project = ProjectEntry(name="Internal Tooling")
    assert project.name == "Internal Tooling"
    assert project.description is None
    assert project.achievements == []
    assert project.stack == []


def test_project_entry_accepts_full_shape():
    project = ProjectEntry(
        name="Data Pipeline",
        description="Batch ETL pipeline",
        achievements=["Reduced runtime by 40%", "Migrated to Airflow"],
        stack=["Python", "Airflow", "Spark"],
    )
    assert project.description == "Batch ETL pipeline"
    assert project.achievements == ["Reduced runtime by 40%", "Migrated to Airflow"]
    assert project.stack == ["Python", "Airflow", "Spark"]


# cv-upload-hardening: found on the SAME real CV, one layer deeper — after
# "YYYY-MM" was fixed, the LLM also produced "Month YYYY" dates, mixing
# English and Spanish month abbreviations ("Jun 2021", "sep 2015", "Dic
# 2022") to match how the source CV itself writes dates.
@pytest.mark.parametrize(
    "raw,expected_iso",
    [
        ("Jun 2021", "2021-06-01"),
        ("sep 2015", "2015-09-01"),
        ("Feb 2024", "2024-02-01"),
        ("Nov 2024", "2024-11-01"),
        ("Dic 2022", "2022-12-01"),  # Spanish abbreviation for December
        ("Ene 2020", "2020-01-01"),  # Spanish abbreviation for January
    ],
)
def test_work_experience_accepts_month_name_dates(raw, expected_iso):
    entry = WorkExperienceEntry(company="Acme", position="Engineer", start_date=raw)
    assert entry.start_date.isoformat() == expected_iso
