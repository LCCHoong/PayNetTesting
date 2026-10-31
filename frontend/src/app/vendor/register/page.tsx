"use client";

import { BACKEND_URL } from "@/lib/backend-url";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";

function passwordError(value: string): string {
  if (new TextEncoder().encode(value).length > 72)
    return "Password is too long. Please shorten it; emoji and accented characters use more space.";
  if (
    Array.from(value).length < 12 ||
    !/[a-z]/.test(value) ||
    !/[A-Z]/.test(value) ||
    !/[0-9]/.test(value) ||
    !/[^a-zA-Z0-9\s]/.test(value)
  )
    return "Password: use at least 12 characters, including an uppercase letter, a lowercase letter, a number and a symbol.";
  return "";
}

type Step = "details" | "verification";

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("details");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const issue = passwordError(password);
    if (issue) { setError(issue); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/auth/send-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "register" }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Failed to send verification code.");
      }
      setStep("verification");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const issue = passwordError(password);
    if (issue) { setStep("details"); setError(issue); return; }
    if (password !== confirmPassword) { setStep("details"); setError("Passwords do not match."); return; }
    if (!/^[0-9]{6,8}$/.test(verificationCode)) { setError("Enter all 6–8 digits from your latest email."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/auth/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code: verificationCode,
          purpose: "register",
          name,
          password,
          phone_number: phoneNumber,
          account_type: "customer",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data.detail === "string" ? data.detail : "Could not verify your details.";
        if (/password|uppercase|UTF-8/i.test(msg)) { setStep("details"); }
        setError(msg);
        return;
      }

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("userRole", data.role);
      localStorage.setItem("userName", data.name);
      sessionStorage.removeItem("registerData");

      router.push("/");
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await fetch(`${BACKEND_URL}/auth/send-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "register" }),
      });
      if (res.ok) alert("Code resent to your email!");
      else setError("Failed to resend code.");
    } catch {
      setError("Error resending code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create an Account</h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === "verification"
              ? "Verify your email to finish creating your account."
              : "Sign up to start ordering from campus merchants."}
          </p>
        </div>

        {/* Info banner — merchant access is admin-approved */}
        {step === "details" && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-xl">
            <span className="font-semibold">Are you a merchant?</span> Register as a customer first — an admin will upgrade your account to merchant after reviewing your application.
          </div>
        )}

        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
            {error}
          </div>
        )}

        {step === "details" && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Full Name</label>
              <input
                type="text" required value={name}
                onChange={(e) => setName(e.target.value)} placeholder="John Doe"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email Address</label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Phone Number</label>
              <input
                type="tel" value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+60123456789"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <div>
              <label htmlFor="register-password" className="block text-xs font-semibold text-gray-700 uppercase mb-1">Password</label>
              <PasswordInput
                id="register-password" label="Password" minLength={12}
                autoComplete="new-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
              />
              <p className="mt-2 text-xs text-gray-500">
                At least 12 characters with uppercase, lowercase, a number and a symbol.
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-gray-700 uppercase mb-1">Confirm Password</label>
              <PasswordInput
                id="confirm-password" label="Confirm password"
                autoComplete="new-password" required
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Enter your password again"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? "Sending Code..." : "Send Verification Code"}
            </button>

            <div className="text-center pt-1 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Already have an account?{" "}
                <Link href="/login" className="text-orange-600 font-semibold hover:underline">Log in</Link>
              </p>
            </div>
          </form>
        )}

        {step === "verification" && (
          <form onSubmit={handleVerifyAndRegister} className="space-y-4">
            <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-center">
              <p className="text-green-700 text-xs font-medium">✅ Code sent to {email}</p>
            </div>

            <div>
              <label htmlFor="verification-code" className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Verification Code (6–8 digits)
              </label>
              <input
                type="text" id="verification-code"
                inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}"
                required
                onPaste={(e) => {
                  e.preventDefault();
                  setVerificationCode(e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8));
                }}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Enter email code"
                className="w-full px-4 py-3 text-center text-2xl font-bold tracking-widest border-2 border-orange-200 rounded-lg focus:outline-none focus:border-orange-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter every digit from the latest email. Code expires in 10 minutes.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || verificationCode.length < 6}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? "Creating Account..." : "Verify & Create Account"}
            </button>

            <button
              type="button" onClick={handleResend} disabled={resending}
              className="w-full text-orange-600 hover:text-orange-700 font-semibold text-sm py-2 disabled:opacity-50"
            >
              {resending ? "Sending..." : "Resend Code"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("details"); setVerificationCode(""); setError(""); }}
              className="w-full text-gray-600 hover:text-gray-700 font-semibold text-sm py-2"
            >
              Go Back
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
