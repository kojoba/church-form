import supabase from "../config/supabase.js";
import {sendTransactionalEmail} from "../config/email.js";

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
    .select(`
      id,
      member_id,
      seat_code,
      column_number,
      lane_number,
      seat_number,
      assignment_order,
      assigned_at
    `)
    .eq("member_id", memberId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function sendDuplicateResponse(res) {
  return res.status(409).json({
    success: false,
    duplicate: true,
    message:
      "You have already registered for FGC 2026. You do not need to register again.",
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
      return sendDuplicateResponse(res);
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
          return sendDuplicateResponse(res);
        }
      }

      throw insertError;
    }

    /*
     * The database trigger creates the seat assignment
     * after inserting the member.
     */

    return res.status(201).json({
      success: true,
      message:
        "Registration completed successfully. Your seat will be assigned when you arrive at the conference.",
      data: member,
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

    return res.status(200).json({
      success: true,
      duplicate: true,
      message:
        "You have already registered for FGC 2026. You do not need to register again.",
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
        seat:church_member_seats!fgc_live_seats_member_fkey (
          id,
          seat_code,
          column_number,
          lane_number,
          seat_number,
          assignment_order,
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
// GET /api/members/seating-chart
export async function getSeatingChart(req, res) {
  try {
    const { data, error } = await supabase
      .from("church_member_seats")
      .select(`
        id,
        seat_code,
        column_number,
        lane_number,
        seat_number,
        assignment_order,
        assigned_at,
        member:church_members!fgc_live_seats_member_fkey (
          id,
          full_name,
          contact_number,
          email,
          education_level
        )
      `)
      .order("assignment_order", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    const seats = data ?? [];

    const columns = Array.from(
      { length: 4 },
      (_, columnIndex) => {
        const columnNumber = columnIndex + 1;

        const columnSeats = seats.filter(
          (seat) =>
            seat.column_number === columnNumber
        );

        return {
          column_number: columnNumber,
          total: columnSeats.length,
          assigned: columnSeats.filter(
            (seat) => Boolean(seat.member)
          ).length,
          available: columnSeats.filter(
            (seat) => !seat.member
          ).length,

          lanes: Array.from(
            { length: 12 },
            (_, laneIndex) => {
              const laneNumber = laneIndex + 1;

              return {
                lane_number: laneNumber,
                seats: columnSeats.filter(
                  (seat) =>
                    seat.lane_number === laneNumber
                ),
              };
            }
          ),
        };
      }
    );

    return res.status(200).json({
      success: true,
      total_seats: seats.length,
      assigned_seats: seats.filter(
        (seat) => Boolean(seat.member)
      ).length,
      available_seats: seats.filter(
        (seat) => !seat.member
      ).length,
      data: columns,
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
        seat:church_member_seats!fgc_live_seats_member_fkey (
          id,
          seat_code,
          column_number,
          lane_number,
          seat_number,
          assignment_order,
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
        seat:church_member_seats!fgc_live_seats_member_fkey (
          seat_code,
          column_number,
          lane_number,
          seat_number,
          assignment_order,
          assigned_at
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

    const emailResult = await sendTransactionalEmail({
      to: member.email,
      toName: member.full_name,
      subject: `FGC 2026 Reminder – ${seat.seat_code}`,
      text: reminderMessage,
    });

    console.log("Reminder email submitted:", {
      memberId: member.id,
      recipient: member.email,
      seatCode: seat.seat_code,
      messageId: emailResult.messageId,
    });

    return res.status(200).json({
      success: true,
      message: `Reminder sent successfully to ${member.email}.`,
      seat_code: seat.seat_code,
      sent_to: member.email,
    });
    } catch (error) {
      console.error("Send reminder error:", {
        code: error.code,
        message: error.message,
        status: error.status,
        details: error.details,
        cause: error.cause,
      });

      if (error.name === "TimeoutError") {
        return res.status(503).json({
          success: false,
          message:
            "The email provider took too long to respond. Please try again.",
        });
      }

      if (error.code === "EMAIL_CONFIGURATION_ERROR") {
        return res.status(500).json({
          success: false,
          message:
            "The email service has not been configured correctly.",
        });
      }

      if (error.code === "BREVO_API_ERROR") {
        return res.status(502).json({
          success: false,
          message:
            error.message ||
            "The email provider rejected the reminder.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to send the reminder email.",
      });
    }
}

// POST /api/members/:id/assign-seat
export async function assignMemberSeat(req, res) {
  try {
    const memberId = Number(req.params.id);

    if (!Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID.",
      });
    }

    const { data: member, error: memberError } =
      await supabase
        .from("church_members")
        .select(`
          id,
          full_name,
          contact_number,
          email,
          education_level
        `)
        .eq("id", memberId)
        .maybeSingle();

    if (memberError) {
      throw memberError;
    }

    if (!member) {
      return res.status(404).json({
        success: false,
        message:
          "This participant is not registered. Please ask them to complete the registration form.",
      });
    }

    const { data: allocation, error: allocationError } =
      await supabase.rpc("assign_next_fgc_seat", {
        p_member_id: memberId,
      });

    if (allocationError) {
      const databaseMessage = [
        allocationError.message,
        allocationError.details,
        allocationError.hint,
      ]
        .filter(Boolean)
        .join(" ");

      if (
        databaseMessage.includes(
          "ALL_CONFERENCE_SEATS_ASSIGNED"
        )
      ) {
        return res.status(409).json({
          success: false,
          message:
            "All 288 conference seats have already been assigned.",
        });
      }

      if (
        databaseMessage.includes(
          "REGISTERED_MEMBER_NOT_FOUND"
        )
      ) {
        return res.status(404).json({
          success: false,
          message:
            "This participant is not registered.",
        });
      }

      throw allocationError;
    }

    const seat = allocation?.seat;
    const alreadyAssigned =
      allocation?.already_assigned === true;

    if (!seat?.seat_code) {
      throw new Error(
        "The database did not return an assigned seat."
      );
    }

    return res
      .status(alreadyAssigned ? 200 : 201)
      .json({
        success: true,
        already_assigned: alreadyAssigned,
        message: alreadyAssigned
          ? `${member.full_name} already has seat ${seat.seat_code}.`
          : `${seat.seat_code} has been assigned to ${member.full_name}.`,
        seat_code: seat.seat_code,
        data: {
          member,
          seat,
        },
      });
  } catch (error) {
    console.error("Assign seat error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to assign a seat.",
    });
  }
}

// DELETE /api/members/:id/seat
export async function releaseMemberSeat(req, res) {
  try {
    const memberId = Number(req.params.id);

    if (!Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID.",
      });
    }

    const { data: member, error: memberError } =
      await supabase
        .from("church_members")
        .select("id, full_name")
        .eq("id", memberId)
        .maybeSingle();

    if (memberError) {
      throw memberError;
    }

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Registered participant not found.",
      });
    }

    const { data: result, error } =
      await supabase.rpc("release_fgc_seat", {
        p_member_id: memberId,
      });

    if (error) {
      throw error;
    }

    if (!result?.success) {
      return res.status(409).json({
        success: false,
        message:
          result?.message ||
          "This participant does not have an assigned seat.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `${member.full_name}'s seat has been released.`,
      released_seat_code:
        result.seat?.seat_code ?? null,
    });
  } catch (error) {
    console.error("Release seat error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to release the seat.",
    });
  }
}