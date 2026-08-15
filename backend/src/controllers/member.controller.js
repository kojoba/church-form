import supabase from "../config/supabase.js";

const EDUCATION_LEVELS = [
  "Junior High",
  "Senior High",
  "Undergraduate",
  "Graduate",
];

function normalizeMember(body) {
  const email =
    typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  return {
    full_name:
      typeof body.full_name === "string"
        ? body.full_name.trim()
        : "",

    date_of_birth:
      typeof body.date_of_birth === "string"
        ? body.date_of_birth.trim()
        : "",

    contact_number:
      typeof body.contact_number === "string"
        ? body.contact_number.trim()
        : "",

    email: email || null,

    education_level:
      typeof body.education_level === "string"
        ? body.education_level.trim()
        : "",
  };
}

function isValidDate(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return false;
  }

  const parsedDate = new Date(`${dateValue}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === dateValue
  );
}

function validateMember(member) {
  const errors = {};

  if (!member.full_name || member.full_name.length < 2) {
    errors.full_name =
      "Full name is required and must contain at least 2 characters.";
  }

  if (!member.date_of_birth) {
    errors.date_of_birth = "Date of birth is required.";
  } else if (!isValidDate(member.date_of_birth)) {
    errors.date_of_birth = "Enter a valid date in YYYY-MM-DD format.";
  } else {
    const today = new Date().toISOString().slice(0, 10);

    if (member.date_of_birth > today) {
      errors.date_of_birth = "Date of birth cannot be in the future.";
    }
  }

  if (!member.contact_number) {
    errors.contact_number = "Contact number is required.";
  } else {
    const cleanedContact = member.contact_number.replace(
      /[\s()-]/g,
      ""
    );

    if (!/^\+?\d{7,15}$/.test(cleanedContact)) {
      errors.contact_number =
        "Enter a valid contact number.";
    }
  }

  if (
    member.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)
  ) {
    errors.email = "Enter a valid email address.";
  }

  if (!EDUCATION_LEVELS.includes(member.education_level)) {
    errors.education_level =
      "Education level must be Junior High, Senior High, Undergraduate, or Graduate.";
  }

  return errors;
}

// POST /api/members
export async function createMember(req, res) {
  try {
    const member = normalizeMember(req.body);
    const validationErrors = validateMember(member);

    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationErrors,
      });
    }

    const { data, error } = await supabase
      .from("church_members")
      .insert(member)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Church form submitted successfully.",
      data,
    });
  } catch (error) {
    console.error("Create member error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to submit church form.",
      error: error.message,
    });
  }
}

// GET /api/members
export async function getMembers(req, res) {
  try {
    const { data, error } = await supabase
      .from("church_members")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Get members error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve church members.",
      error: error.message,
    });
  }
}

// GET /api/members/:id
export async function getMemberById(req, res) {
  try {
    const memberId = Number(req.params.id);

    if (!Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID.",
      });
    }

    const { data, error } = await supabase
      .from("church_members")
      .select("*")
      .eq("id", memberId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Church member not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get member error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve church member.",
      error: error.message,
    });
  }
}