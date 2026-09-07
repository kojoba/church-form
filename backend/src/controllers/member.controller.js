import supabase from "../config/supabase.js";
import mailer from "../config/mailer.js";

const EDUCATION_LEVELS = [
  "Junior High",
  "Senior High",
  "Undergraduate",
  "Graduate",
  "Professionals",
  "Young Professionals",
];

const SEAT_GROUPS = [
  {
    code: "JHS",
    label: "Junior High",
  },
  {
    code: "SHS",
    label: "Senior High",
  },
  {
    code: "UG",
    label: "Undergraduate",
  },
  {
    code: "GR",
    label: "Graduate",
  },
  {
    code: "PR",
    label: "Young Professionals and Professionals",
  },
];

function normalizeName(value = "") {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizePhone(value = "") {
  let phone = String(value ?? "").replace(/\D/g, "");

  if (phone.startsWith("00233")) {
    phone = phone.slice(2);
  }

  if (phone.startsWith("0") && phone.length === 10) {
    phone = `233${phone.slice(1)}`;
  }

  return phone;
}

function normalizeEmail(value = "") {
  const email = String(value ?? "").trim().toLowerCase();

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
    errors.date_of_birth =
      "Enter a valid date in YYYY-MM-DD format.";
  } else {
    const today = new Date().toISOString().slice(0, 10);

    if (member.date_of_birth > today) {
      errors.date_of_birth =
        "Date of birth cannot be in the future.";
    }
  }

  if (!member.contact_number) {
    errors.contact_number = "Contact number is required.";
  } else if (!/^\d{7,15}$/.test(member.contact_number)) {
    errors.contact_number = "Enter a valid contact number.";
  }

  if (
    member.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)
  ) {
    errors.email = "Enter a valid email address.";
  }

  if (!EDUCATION_LEVELS.includes(member.education_level)) {
    errors.education_level =
      `Education level must be one of the following: ` +
      `${EDUCATION_LEVELS.join(", ")}.`;
  }

  return errors;
}

async function findExistingMember(memberData) {
  const { data, error } = await supabase
    .from("church_members")
    .select("id, full_name")
    .eq("date_of_birth", memberData.date_of_birth)
    .eq("contact_number", memberData.contact_number)
    .limit(10);

  if (error) {
    throw error;
  }

  return (data ?? []).find((member) =>
    sameName(member.full_name, memberData.full_name)
  );
}

async function getMemberSeat(memberId) {
  const { data, error } = await supabase
    .from("church_member_seats")
    .select(
      "id, member_id, seat_code, seat_group, seat_number, assigned_at"
    )
    .eq("member_id", memberId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function sendDuplicateResponse(res, seat) {
  return res.status(409).json({
    success: false,
    duplicate: true,
    message: seat
      ? `You have already registered for FGC 2026. Your seat code is ${seat.seat_code}.`
      : "You have already registered for FGC 2026.",
    seat_code: seat?.seat_code ?? null,
    seat: seat ?? null,
  });
}

// POST /api/members
export async function createMember(req, res) {
  try {
    const body = req.body ?? {};

    const memberData = {
      full_name: normalizeName(body.full_name),
      date_of_birth: body.date_of_birth,
      contact_number: normalizePhone(body.contact_number),
      email: normalizeEmail(body.email),
      education_level: body.education_level?.trim(),
    };

    const validationErrors = validateMember(memberData);

    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please correct the highlighted fields.",
        errors: validationErrors,
      });
    }

    const existingMember =
      await findExistingMember(memberData);

    if (existingMember) {
      const seat = await getMemberSeat(existingMember.id);

      return sendDuplicateResponse(res, seat);
    }

    const { data: member, error: insertError } =
      await supabase
        .from("church_members")
        .insert(memberData)
        .select()
        .single();

    if (insertError) {
      /*
       * Handles two requests that pass the duplicate check
       * at nearly the same time.
       */
      if (insertError.code === "23505") {
        const duplicatedMember =
          await findExistingMember(memberData);

        if (duplicatedMember) {
          const seat = await getMemberSeat(
            duplicatedMember.id
          );

          return sendDuplicateResponse(res, seat);
        }
      }

      throw insertError;
    }

    /*
     * The database trigger creates the seat assignment
     * after inserting the member.
     */
    const seat = await getMemberSeat(member.id);

    if (!seat) {
      throw new Error(
        `No seat assignment was created for member ${member.id}.`
      );
    }

    return res.status(201).json({
      success: true,
      message:
        `Registration completed successfully. ` +
        `Your seat code is ${seat.seat_code}.`,
      seat_code: seat.seat_code,
      data: {
        ...member,
        seat,
      },
    });
  } catch (error) {
    console.error("Member registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to complete the registration.",
    });
  }
}

// POST /api/members/check-duplicate
export async function getDuplicate(req, res) {
  try {
    const body = req.body ?? {};

    const memberData = {
      full_name: normalizeName(body.full_name),
      date_of_birth: body.date_of_birth,
      contact_number: normalizePhone(body.contact_number),
    };

    if (
      !memberData.full_name ||
      !memberData.date_of_birth ||
      !memberData.contact_number
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, date of birth and contact number are required for the check.",
      });
    }

    if (!isValidDate(memberData.date_of_birth)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid date of birth.",
      });
    }

    const existingMember =
      await findExistingMember(memberData);

    if (!existingMember) {
      return res.status(200).json({
        success: true,
        duplicate: false,
        seat_code: null,
        message: "No existing registration was found.",
      });
    }

    const seat = await getMemberSeat(existingMember.id);

    return res.status(200).json({
      success: true,
      duplicate: true,
      seat_code: seat?.seat_code ?? null,
      seat: seat ?? null,
      message: seat
        ? `You have already registered for FGC 2026. Your seat code is ${seat.seat_code}.`
        : "You have already registered for FGC 2026.",
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
      .select(`
        *,
        seat:church_member_seats (
          seat_code,
          seat_group,
          seat_number,
          assigned_at
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      count: data?.length ?? 0,
      data: data ?? [],
    });
  } catch (error) {
    console.error("Get members error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve church members.",
    });
  }
}

// GET /api/members/seating-chart
export async function getSeatingChart(req, res) {
  try {
    const { data, error } = await supabase
      .from("church_member_seats")
      .select(`
        seat_code,
        seat_group,
        seat_number,
        assigned_at,
        member:church_members (
          id,
          full_name,
          education_level,
          contact_number,
          email
        )
      `)
      .order("seat_number", { ascending: true });

    if (error) {
      throw error;
    }

    const seats = data ?? [];

    const seatingChart = SEAT_GROUPS.map((group) => ({
      seat_group: group.code,
      education_group: group.label,
      count: seats.filter(
        (seat) => seat.seat_group === group.code
      ).length,
      seats: seats
        .filter((seat) => seat.seat_group === group.code)
        .sort(
          (firstSeat, secondSeat) =>
            firstSeat.seat_number -
            secondSeat.seat_number
        ),
    }));

    return res.status(200).json({
      success: true,
      total: seats.length,
      data: seatingChart,
    });
  } catch (error) {
    console.error("Get seating chart error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve the seating chart.",
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
      .select(`
        *,
        seat:church_member_seats (
          seat_code,
          seat_group,
          seat_number,
          assigned_at
        )
      `)
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
    console.error("Get member error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve church member.",
    });
  }
}

// POST /api/members/:id/send-reminder
export async function sendMemberReminder(req, res) {
  try {
    const memberId = Number(req.params.id);

    if (!Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID.",
      });
    }

    const { data: member, error } = await supabase
      .from("church_members")
      .select(`
        id,
        full_name,
        email,
        education_level,
        seat:church_member_seats (
          seat_code,
          seat_group,
          seat_number
        )
      `)
      .eq("id", memberId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Registered member not found.",
      });
    }

    if (!member.email) {
      return res.status(400).json({
        success: false,
        message: "This member did not provide an email address.",
      });
    }

    const seat = Array.isArray(member.seat)
      ? member.seat[0]
      : member.seat;

    if (!seat?.seat_code) {
      return res.status(400).json({
        success: false,
        message: "This member does not have a seat code.",
      });
    }

    const eventDate = process.env.FGC_EVENT_DATE;
    const eventLocation = process.env.FGC_EVENT_LOCATION;

    const reminderMessage = `
Hello ${member.full_name},

This is a friendly reminder about the Future Generation Conference 2026.

Conference details:

Date: Saturday 19, September 2026
Location: CAC Comm. 4 Church Premises, Vera Junction
Your seat code: ${seat.seat_code}

Please keep your seat code safe and present it when you arrive at the conference venue.

We look forward to welcoming you.

Regards,
Future Generation Conference Team
`.trim();

    await mailer.sendMail({
      from: process.env.MAIL_FROM,
      to: member.email,
      replyTo: process.env.SMTP_USER,
      subject: `FGC 2026 Reminder – ${seat.seat_code}`,
      text: reminderMessage,
    });

    return res.status(200).json({
      success: true,
      message: `Reminder sent successfully to ${member.email}.`,
      seat_code: seat.seat_code,
      sent_to: member.email,
    });
  } catch (error) {
    console.error("Send reminder error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to send the reminder email.",
    });
  }
}