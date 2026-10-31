// frontend/src/app/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Global country calling codes
const COUNTRY_CODES = [
  { code: "+60", name: "Malaysia" },
  { code: "+93", name: "Afghanistan" },
  { code: "+355", name: "Albania" },
  { code: "+213", name: "Algeria" },
  { code: "+54", name: "Argentina" },
  { code: "+61", name: "Australia" },
  { code: "+43", name: "Austria" },
  { code: "+973", name: "Bahrain" },
  { code: "+880", name: "Bangladesh" },
  { code: "+32", name: "Belgium" },
  { code: "+673", name: "Brunei" },
  { code: "+855", name: "Cambodia" },
  { code: "+1", name: "Canada / USA" },
  { code: "+86", name: "China" },
  { code: "+20", name: "Egypt" },
  { code: "+33", name: "France" },
  { code: "+49", name: "Germany" },
  { code: "+852", name: "Hong Kong" },
  { code: "+91", name: "India" },
  { code: "+62", name: "Indonesia" },
  { code: "+81", name: "Japan" },
  { code: "+962", name: "Jordan" },
  { code: "+82", name: "South Korea" },
  { code: "+965", name: "Kuwait" },
  { code: "+856", name: "Laos" },
  { code: "+961", name: "Lebanon" },
  { code: "+960", name: "Maldives" },
  { code: "+95", name: "Myanmar" },
  { code: "+977", name: "Nepal" },
  { code: "+31", name: "Netherlands" },
  { code: "+64", name: "New Zealand" },
  { code: "+234", name: "Nigeria" },
  { code: "+968", name: "Oman" },
  { code: "+92", name: "Pakistan" },
  { code: "+63", name: "Philippines" },
  { code: "+974", name: "Qatar" },
  { code: "+966", name: "Saudi Arabia" },
  { code: "+65", name: "Singapore" },
  { code: "+27", name: "South Africa" },
  { code: "+34", name: "Spain" },
  { code: "+94", name: "Sri Lanka" },
  { code: "+46", name: "Sweden" },
  { code: "+41", name: "Switzerland" },
  { code: "+886", name: "Taiwan" },
  { code: "+66", name: "Thailand" },
  { code: "+90", name: "Turkey" },
  { code: "+971", name: "UAE" },
  { code: "+44", name: "United Kingdom" },
  { code: "+84", name: "Vietnam" },
].sort((a, b) => (a.name === "Malaysia" ? -1 : a.name.localeCompare(b.name)));

export default function CustomerRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"register" | "verify">("register");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phonePrefix: "+60",
    phoneNum: "",
    password: "",
  });

  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Step 1: Trigger Sign-Up (Email verification only, NO SMS verification for phone)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Strip non-digits and remove leading zeros (e.g. 012345678 -> 12345678)
    const cleanPhone = formData.phoneNum.replace(/\D/g, "").replace(/^0+/, "");
    
    // Ensure the phone number field isn't empty and has a reasonable length (at least 6 digits)
    if (cleanPhone.length < 6 || cleanPhone.length > 14) {
      setError("Please enter a valid phone number (between 6 and 14 digits).");
      return;
    }

    const fullPhoneNumber = `${formData.phonePrefix}${cleanPhone}`;
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            phone_number: fullPhoneNumber, // Saved as +60123456789
            role: "customer",
          },
        },
      });

      if (error) throw error;
      setStep("verify");
    } catch (err: any) {
      setError(err.message || "Failed to send verification email.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify the Email OTP code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: otp,
        type: "signup",
      });

      if (error) throw error;

      if (data.session) {
        localStorage.setItem("token", data.session.access_token);
        localStorage.setItem("userRole", "customer");
        localStorage.setItem("userName", formData.name);
      }

      router.push("/");
    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FDF9F1] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Create an Account</h1>
          <p className="text-gray-500 text-sm mt-1">Register as a Customer</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 border border-red-100 text-sm font-medium">
            {error}
          </div>
        )}

        {step === "register" ? (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm text-gray-900"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm text-gray-900"
                placeholder="name@sunway.edu.my"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="flex rounded-xl border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-orange-500 overflow-hidden">
                <select
                  name="phonePrefix"
                  value={formData.phonePrefix}
                  onChange={handleChange}
                  className="bg-gray-100 border-r border-gray-300 px-2 py-2.5 text-xs font-medium text-gray-700 focus:outline-none cursor-pointer w-28 truncate"
                >
                  {COUNTRY_CODES.map((country) => (
                    <option key={country.code + country.name} value={country.code}>
                      {country.code} {country.name}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  name="phoneNum"
                  required
                  value={formData.phoneNum}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, ""); // Digits only
                    setFormData({ ...formData, phoneNum: val });
                  }}
                  className="w-full px-3 py-2.5 bg-transparent focus:outline-none text-sm text-gray-900 tracking-wide"
                  placeholder="12345678"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm text-gray-900"
                placeholder="••••••••"
              />
            </div>

            <div className="flex gap-4 pt-2">
              <Link
                href="/login"
                className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-all text-center text-sm flex items-center justify-center"
              >
                Back
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 bg-[#FA5A1E] hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-all shadow-sm cursor-pointer text-sm disabled:opacity-50"
              >
                {loading ? "Registering..." : "Register"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-2 text-center">
                Verify Email
              </label>
              <p className="text-center text-sm text-gray-500 mb-4">
                Enter the 6-digit code sent to<br/><strong>{formData.email}</strong>
              </p>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900"
                placeholder="123456"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FA5A1E] hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-all shadow-sm cursor-pointer mt-2 text-sm disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Confirm & Login"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}