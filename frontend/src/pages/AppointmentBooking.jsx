import { useEffect, useMemo, useState } from "react";
import { Button, MenuItem, TextField } from "@mui/material";
import { BadgeIndianRupee, CalendarPlus, CheckCircle2, CreditCard, ShieldCheck, Smartphone } from "lucide-react";
import { api } from "../api/client";
import StatusBanner from "../components/StatusBanner";

const appointmentTimes = [
  { value: "10:00", label: "10:00 AM" },
  { value: "10:30", label: "10:30 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "11:30", label: "11:30 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "12:30", label: "12:30 PM" },
  { value: "13:00", label: "1:00 PM" },
  { value: "13:30", label: "1:30 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "14:30", label: "2:30 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "15:30", label: "3:30 PM" },
  { value: "16:00", label: "4:00 PM" },
  { value: "16:30", label: "4:30 PM" },
  { value: "17:00", label: "5:00 PM" },
  { value: "17:30", label: "5:30 PM" },
  { value: "18:00", label: "6:00 PM" },
];

function todayISODate() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().split("T")[0];
}

function loadRazorpayCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Could not load Razorpay checkout. Check internet access, ad blockers, or browser script blocking."));
    document.body.appendChild(script);
  });
}

export default function AppointmentBooking() {
  const [form, setForm] = useState({
    doctor_email: "",
    date: "",
    time: "",
    reason: "",
  });

  const [doctors, setDoctors] = useState([]);
  const [appointmentFee, setAppointmentFee] = useState(500);
  const [booking, setBooking] = useState(null);
  const [demoUpiId, setDemoUpiId] = useState("");
  const [slotAvailability, setSlotAvailability] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const slots = useMemo(() => {
    const availabilityByTime = new Map(slotAvailability.map((slot) => [slot.value, slot]));
    return appointmentTimes.map((slot) => ({
      ...slot,
      ...(availabilityByTime.get(slot.value) || {}),
    }));
  }, [slotAvailability]);

  const selectedSlot = slots.find((slot) => slot.value === form.time);
  const selectedSlotUnavailable = Boolean(selectedSlot?.is_booked);

  //  Fetch doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await api.get("/doctors/");

        console.log("DOCTORS RESPONSE:", response);
        console.log("DOCTORS DATA:", response.data);

        //  Ensure array
        if (Array.isArray(response.data)) {
          setDoctors(response.data);
        } else {
          console.error("Doctors response is not an array");
          setDoctors([]);
        }
      } catch (err) {
        console.error("Error fetching doctors:", err);

        if (err.response) {
          console.log("Backend Error:", err.response.data);
        }

        setDoctors([]);
      }
    };

    fetchDoctors();
    api.get("/settings/appointment-fee")
      .then(({ data }) => setAppointmentFee(data.amount_inr))
      .catch(() => setAppointmentFee(500));
  }, []);

  useEffect(() => {
    if (!form.doctor_email || !form.date) {
      setSlotAvailability([]);
      return;
    }

    let active = true;
    setAvailabilityLoading(true);
    api.get("/appointments/availability", {
      params: {
        doctor_email: form.doctor_email,
        appointment_date: form.date,
      },
    })
      .then(({ data }) => {
        if (!active) return;
        const nextSlots = Array.isArray(data.slots) ? data.slots : [];
        setSlotAvailability(nextSlots);
        if (form.time && nextSlots.some((slot) => slot.value === form.time && slot.is_booked)) {
          setForm((current) => ({ ...current, time: "" }));
        }
      })
      .catch(() => {
        if (active) setSlotAvailability([]);
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.doctor_email, form.date, form.time, availabilityRefresh]);

  //  Create appointment
  const submit = async (event) => {
    event?.preventDefault();
    if (loading) return;
    if (selectedSlotUnavailable) {
      setError("This slot is already booked for the selected doctor and date. Please choose an available time.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/appointments", {
        doctor_email: form.doctor_email,
        date: form.date,
        time: form.time,
        reason: form.reason,
      });

      if (!data.order?.id || !data.order?.amount) {
        throw new Error("Razorpay order was not created correctly by the backend.");
      }
      if (!data.booking_token) {
        throw new Error("Secure booking session was not created. Please try again.");
      }

      const trimmedDemoUpiId = demoUpiId.trim();
      if (trimmedDemoUpiId) {
        const verify = await api.post("/appointments/payment/demo", {
          booking_token: data.booking_token,
          razorpay_order_id: data.order.id,
          demo_upi_id: trimmedDemoUpiId,
        });
        setBooking({ ...data, appointment_id: verify.data.appointment_id, verification: verify.data, status: "confirmed", demo_upi_id: trimmedDemoUpiId });
        setAvailabilityRefresh((value) => value + 1);
        setError("");
        setLoading(false);
        return;
      }

      await loadRazorpayCheckout();

      const razorpayKey = data.order?.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!razorpayKey || razorpayKey === "rzp_test_demo") {
        throw new Error("Razorpay test key is not configured. Set Razorpay test keys in backend/.env and VITE_RAZORPAY_KEY_ID in frontend/.env.");
      }

      const checkout = new window.Razorpay({
        key: razorpayKey,
        amount: data.order?.amount,
        currency: data.order?.currency || "INR",
        name: "CareSphere AI",
        description: "Appointment booking payment",
        order_id: data.order?.id,
        method: "upi",
        prefill: {
          name: localStorage.getItem("name") || "",
          email: localStorage.getItem("email") || "",
          contact: localStorage.getItem("phone") || "",
        },
        config: {
          display: {
            sequence: ["upi", "card", "netbanking", "wallet"],
            preferences: {
              show_default_blocks: true,
            },
          },
        },
        handler: async (response) => {
          try {
            const verify = await api.post("/appointments/payment/verify", {
              booking_token: data.booking_token,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setBooking({ ...data, appointment_id: verify.data.appointment_id, verification: verify.data, status: "confirmed" });
            setAvailabilityRefresh((value) => value + 1);
            setError("");
          } catch (verifyError) {
            setError(verifyError.response?.data?.detail || "Payment verification failed. Appointment is not confirmed.");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setError("Payment was cancelled. Appointment is not confirmed.");
          },
        },
        theme: {
          color: "#2563eb",
        },
      });

      checkout.on("payment.failed", (response) => {
        console.error("RAZORPAY PAYMENT FAILED:", response.error);
        setLoading(false);
        setError(response.error?.description || "Payment failed. Appointment is not confirmed.");
      });

      checkout.open();
    } catch (err) {
      console.error(err);

      const detail = err.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join(", "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Could not create appointment");
      }
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <form onSubmit={submit} className="panel space-y-4 p-5">
        <div>
          <div className="section-title">
            <span className="icon-badge"><CalendarPlus size={22} /></span>
            <div>
              <h2 className="text-xl font-black">
                Booking Appointment Agent
              </h2>

              <p className="text-sm text-slate-600">
                Opens Razorpay test checkout. Appointment is booked only after successful payment.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <StatusBanner type="error">
            {error}
          </StatusBanner>
        )}

        <div className="grid gap-4 md:grid-cols-2">

          {/* Doctor Dropdown */}
          <TextField
            select
            label="Doctor"
            required
            value={form.doctor_email}
            onChange={(e) =>
              setForm({
                ...form,
                doctor_email: e.target.value,
                time: "",
              })
            }
          >
            {doctors.length > 0 ? (
              doctors.map((doctor, index) => (
                <MenuItem
                  key={doctor._id || index}
                  value={doctor.email}
                >
                  {doctor.label || `${doctor.name || doctor.email} - ${doctor.department || doctor.specialization || "General"}`}
                </MenuItem>
              ))
            ) : (
              <MenuItem disabled>
                No doctors available
              </MenuItem>
            )}
          </TextField>

          {/* Date */}
          <TextField
            label="Date"
            type="date"
            required
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: todayISODate() }}
            value={form.date}
            onChange={(e) =>
              setForm({
                ...form,
                date: e.target.value,
                time: "",
              })
            }
          />

          {/* Time */}
          <TextField
            select
            label="Time"
            required
            value={form.time}
            helperText={
              form.doctor_email && form.date
                ? availabilityLoading
                  ? "Checking slot availability..."
                  : "Booked slots stay visible but cannot be selected."
                : "Select a doctor and date to check unavailable slots."
            }
            onChange={(e) =>
              setForm({
                ...form,
                time: e.target.value,
              })
            }
          >
            {slots.map((slot) => (
              <MenuItem
                key={slot.value}
                value={slot.value}
                disabled={slot.is_booked}
                sx={{
                  "&.Mui-disabled": {
                    bgcolor: "#cbd5e1",
                    color: "#1f2937",
                    fontWeight: 800,
                    opacity: 1,
                  },
                }}
              >
                {slot.label}{slot.is_booked ? " - unavailable" : ""}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Amount INR"
            value={appointmentFee}
            InputProps={{ readOnly: true }}
            helperText="Fixed by admin"
          />
        </div>

        {/* Reason */}
        <TextField
          fullWidth
          label="Reason"
          required
          multiline
          minRows={3}
          value={form.reason}
          onChange={(e) =>
            setForm({
              ...form,
              reason: e.target.value,
            })
          }
        />

        <Button
          type="submit"
          variant="contained"
          disabled={loading || selectedSlotUnavailable}
          startIcon={loading ? <CreditCard size={17} /> : <CalendarPlus size={17} />}
        >
          {loading ? "Processing Payment" : demoUpiId.trim() ? "Complete Demo UPI Payment" : "Pay and Confirm Booking"}
        </Button>
      </form>

      {/* Payment Section */}
      <div className="panel p-5">
        <div className="section-title mb-4">
          <span className="icon-badge-soft"><BadgeIndianRupee size={18} /></span>
          <h3 className="text-lg font-black">
            Payment
          </h3>
        </div>

        {booking?.status === "confirmed" ? (
          <div className="space-y-3 text-sm">
            <StatusBanner type="success">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={16} />Payment successful. Appointment confirmed.</span>
            </StatusBanner>
            <div className="rounded-lg bg-green-50 p-4 text-center ring-1 ring-green-100">
              <CheckCircle2 className="mx-auto mb-2 text-green-700" size={34} />
              <p className="text-lg font-black text-green-900">Payment Success</p>
              <p className="text-xs font-semibold text-green-700">Your appointment is now booked.</p>
            </div>

            <p>
              <b>Appointment:</b>{" "}
              {booking.appointment_id}
            </p>

            <p>
              <b>Order:</b>{" "}
              {booking.order?.id}
            </p>

            <p>
              <b>Payment:</b>{" "}
              {booking.demo_upi_id ? "demo_upi_success" : booking.verification?.status}
            </p>
            {booking.demo_upi_id && (
              <p>
                <b>Demo UPI:</b>{" "}
                {booking.demo_upi_id}
              </p>
            )}

            <p>
              <b>Amount:</b> INR{" "}
              {booking.order?.amount
                ? (booking.order.amount / 100).toFixed(2)
                : "0"}
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-sm text-slate-500">
            <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="mb-3 flex items-center gap-2 font-black text-slate-800">
                <Smartphone size={18} className="text-blue-700" />
                Demo UPI ID
              </div>
              <TextField
                fullWidth
                size="small"
                label="Enter demo UPI ID"
                placeholder="success@demo"
                value={demoUpiId}
                onChange={(event) => setDemoUpiId(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submit(event);
                  }
                }}
                helperText="Use any test value like success@demo. Appointment is created only after this demo success action."
              />
            </div>
            <p>Enter a demo UPI ID and click Pay and Confirm Booking to create a demo success payment.</p>
            <p>Leave it blank to use the Razorpay test checkout. No appointment is stored if payment is cancelled, failed, closed, or left pending.</p>
          </div>
        )}
      </div>
    </section>
  );
}
