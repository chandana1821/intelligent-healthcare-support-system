import { useEffect, useState } from "react";
import { Button, MenuItem, TextField } from "@mui/material";
import { BadgeIndianRupee, CalendarPlus, CreditCard, ShieldCheck } from "lucide-react";
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Fetch doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await api.get("/doctors/");

        console.log("DOCTORS RESPONSE:", response);
        console.log("DOCTORS DATA:", response.data);

        // ✅ Ensure array
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

  // ✅ Create appointment
  const submit = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/appointments", {
        doctor_email: form.doctor_email,
        date: form.date,
        time: form.time,
        reason: form.reason,
      });

      console.log("APPOINTMENT RESPONSE:", data);

      await loadRazorpayCheckout();

      const razorpayKey = data.order?.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!razorpayKey || razorpayKey === "rzp_test_demo") {
        throw new Error("Razorpay key is not configured. Set VITE_RAZORPAY_KEY_ID in frontend/.env.");
      }
      if (!data.order?.id || !data.order?.amount) {
        throw new Error("Razorpay order was not created correctly by the backend.");
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
              appointment_id: data.appointment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setBooking({ ...data, verification: verify.data, status: "confirmed" });
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
          color: "#0f766e",
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
                Creates the appointment and initializes a Razorpay order.
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
              })
            }
          />

          {/* Time */}
          <TextField
            select
            label="Time"
            required
            value={form.time}
            onChange={(e) =>
              setForm({
                ...form,
                time: e.target.value,
              })
            }
          >
            {appointmentTimes.map((slot) => (
              <MenuItem key={slot.value} value={slot.value}>
                {slot.label}
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
          disabled={loading}
          startIcon={loading ? <CreditCard size={17} /> : <CalendarPlus size={17} />}
        >
          {loading ? "Processing Payment" : "Pay and Confirm Booking"}
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
              {booking.verification?.status}
            </p>

            <p>
              <b>Amount:</b> INR{" "}
              {booking.order?.amount
                ? (booking.order.amount / 100).toFixed(2)
                : "0"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Booking is confirmed only after successful Razorpay payment.
          </p>
        )}
      </div>
    </section>
  );
}
