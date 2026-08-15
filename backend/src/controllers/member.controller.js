import supabase from "../config/supabase.js";

const EDUCATION_LEVELS = [
  "Junior High",
  "Senior High",
  "Undergraduate",
  "Graduate",
];

function normalizeName(value = "") {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizePhone(value = "") {
  let phone = value.replace(/\D/g, "");

  if (phone.startsWith("00233")) {
    phone = phone.slice(2);
  }

  if (phone.startsWith("0") && phone.length === 10) {
    phone = `233${phone.slice(1)}`;
  }

  return phone;
}

function normalizeEmail(value = "") {
  const email = value.trim().toLowerCase();
  return email || null;
}

function sameName(firstName, secondName) {
  return (
    normalizeName(firstName).toLowerCase() ===
    normalizeName(secondName).toLowerCase()
  );
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
    const memberData = {
      full_name: normalizeName(req.body.full_name),
      date_of_birth: req.body.date_of_birth,
      contact_number: normalizePhone(req.body.contact_number),
      email: normalizeEmail(req.body.email),
      education_level: req.body.education_level,
    };

    if (
      !memberData.full_name ||
      !memberData.date_of_birth ||
      !memberData.contact_number ||
      !memberData.education_level
    ) {
      return res.status(400).json({
        success: false,
        message: "Please complete all required fields.",
      });
    }

    /*
     * Find possible duplicates using date of birth and phone.
     * Compare the normalized names afterwards.
     */
    const { data: possibleDuplicates, error: checkError } = await supabase
      .from("church_members")
      .select("id, full_name")
      .eq("date_of_birth", memberData.date_of_birth)
      .eq("contact_number", memberData.contact_number)
      .limit(10);

    if (checkError) {
      throw checkError;
    }

    const duplicateExists = (possibleDuplicates ?? []).some((member) =>
      sameName(member.full_name, memberData.full_name)
    );

    if (duplicateExists) {
      return res.status(409).json({
        success: false,
        message:
          "You have already registered for FGC 2026. You do not need to register again.",
      });
    }

    const { data, error } = await supabase
      .from("church_members")
      .insert(memberData)
      .select()
      .single();

    if (error) {
      const errorInformation = [
        error.code,
        error.message,
        error.details,
      ].join(" ");

      if (
        error.code === "23505" ||
        errorInformation.includes("church_members_unique_person")
      ) {
        return res.status(409).json({
          success: false,
          message:
            "You have already registered for FGC 2026. You do not need to register again.",
        });
      }

      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Registration completed successfully.",
      data,
    });
  } catch (error) {
    console.error("Member registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to complete the registration.",
    });
  }
}

export async function getDuplicate(req, res){
    try {
    const fullName = normalizeName(req.body.full_name);
    const dateOfBirth = req.body.date_of_birth;
    const contactNumber = normalizePhone(req.body.contact_number);

    if (!fullName || !dateOfBirth || !contactNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Name, date of birth and contact number are required for the check.",
      });
    }

    const { data, error } = await supabase
      .from("church_members")
      .select("id, full_name")
      .eq("date_of_birth", dateOfBirth)
      .eq("contact_number", contactNumber)
      .limit(10);

    if (error) {
      throw error;
    }

    const duplicate = (data ?? []).some((member) =>
      sameName(member.full_name, fullName)
    );

    return res.status(200).json({
      success: true,
      duplicate,
      message: duplicate
        ? "You have already registered for FGC 2026."
        : "No existing registration was found.",
    });
  } catch (error) {
    console.error("Duplicate check error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to check the registration details.",
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