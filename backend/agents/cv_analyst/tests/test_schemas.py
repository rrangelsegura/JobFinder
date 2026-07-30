import pytest

from agents.cv_analyst.schemas import (
    CertificationEntry,
    CvExtractionResult,
    EducationEntry,
    LanguageEntry,
    PersonalInfo,
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
