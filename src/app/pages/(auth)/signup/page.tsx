"use client";

import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { motion } from "framer-motion";
import {
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon,
  PhotoIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client";
import {
  SEND_OTP_MUTATION,
  VERIFY_OTP_MUTATION,
  SIGNUP_MUTATION,
} from "@/graphql/query/query";
import { setCookie } from "cookies-next";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { SignupInput } from "@/utils/type";

// Enum for signup steps
enum SignupStep {
  INITIAL_INFO = "INITIAL_INFO",
  OTP_VERIFICATION = "OTP_VERIFICATION",
  COMPLETE_SIGNUP = "COMPLETE_SIGNUP",
}

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<SignupStep>(
    SignupStep.INITIAL_INFO
  );
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [resendDisabled, setResendDisabled] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const router = useRouter();

  // GraphQL mutations
  const [sendOtp] = useMutation(SEND_OTP_MUTATION);
  const [verifyOtp] = useMutation(VERIFY_OTP_MUTATION);
  const [signup] = useMutation(SIGNUP_MUTATION);

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    setPasswordStrength(strength);
  };

  // Avatar change handler
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      // Create a preview URL
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
    }
  };

  // Initial form for collecting user information
  const initialFormik = useFormik({
    initialValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    validationSchema: Yup.object({
      firstName: Yup.string()
        .min(3, "Must be at least 3 characters")
        .max(20, "Must be 20 characters or less")
        .required("Required"),
      lastName: Yup.string()
        .min(3, "Must be at least 3 characters")
        .max(20, "Must be 20 characters or less")
        .required("Required"),
      email: Yup.string().email("Invalid email address").required("Required"),
      password: Yup.string()
        .min(8, "Must be at least 8 characters")
        .required("Required"),
      confirmPassword: Yup.string()
        .oneOf([Yup.ref("password"), undefined], "Passwords must match")
        .required("Required"),
    }),
    onSubmit: async (values) => {
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        // Send OTP to user's email
        const { data } = await sendOtp({
          variables: {
            input: {
              email: values.email,
            },
          },
        });

        if (data?.sendOtp.success) {
          setSuccessMessage(data.sendOtp.message);
          setCurrentStep(SignupStep.OTP_VERIFICATION);

          // Start the resend cooldown
          setResendDisabled(true);
          setCountdown(60);
          const timer = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(timer);
                setResendDisabled(false);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          setErrorMessage(
            data?.sendOtp.message || "Failed to send OTP. Please try again."
          );
        }
      } catch (error: any) {
        console.error("OTP send failed:", error);
        setErrorMessage(
          error.message || "Failed to send OTP. Please try again."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  // OTP verification form
  const otpFormik = useFormik({
    initialValues: {
      otp: "",
    },
    validationSchema: Yup.object({
      otp: Yup.string()
        .matches(/^\d{6}$/, "OTP must be 6 digits")
        .required("Required"),
    }),
    onSubmit: async (values) => {
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const { data } = await verifyOtp({
          variables: {
            input: {
              email: initialFormik.values.email,
              otp: values.otp,
            },
          },
        });

        if (data?.verifyOtp.success) {
          setSuccessMessage(data.verifyOtp.message);
          setEmailVerified(true);
          setCurrentStep(SignupStep.COMPLETE_SIGNUP);
        } else {
          setErrorMessage(
            data?.verifyOtp.message ||
              "OTP verification failed. Please try again."
          );
        }
      } catch (error: any) {
        console.error("OTP verification failed:", error);
        setErrorMessage(
          error.message || "OTP verification failed. Please try again."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  // Handle resending OTP
  const handleResendOtp = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { data } = await sendOtp({
        variables: {
          input: {
            email: initialFormik.values.email,
          },
        },
      });

      if (data?.sendOtp.success) {
        setSuccessMessage("OTP resent successfully!");

        // Start the resend cooldown
        setResendDisabled(true);
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              setResendDisabled(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setErrorMessage(
          data?.sendOtp.message || "Failed to resend OTP. Please try again."
        );
      }
    } catch (error: any) {
      console.error("OTP resend failed:", error);
      setErrorMessage(
        error.message || "Failed to resend OTP. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete signup after OTP verification
  const completeSignup = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Prepare signup input
      const signupInput: SignupInput = {
        firstName: initialFormik.values.firstName,
        lastName: initialFormik.values.lastName,
        email: initialFormik.values.email,
        password: initialFormik.values.password,
      };

      // Add avatar as base64 if one was selected
      if (avatarFile) {
        // Convert file to base64
        const reader = new FileReader();
        reader.readAsDataURL(avatarFile);

        reader.onload = async () => {
          const base64 = reader.result as string;
          signupInput.avatarBase64 = base64;

          await performSignup(signupInput);
        };
      } else {
        await performSignup(signupInput);
      }
    } catch (error: any) {
      console.error("Signup failed:", error);
      setErrorMessage(error.message || "Signup failed. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Helper function to perform the actual signup mutation
  const performSignup = async (input: SignupInput) => {
    try {
      const { data } = await signup({
        variables: {
          input,
        },
      });


        router.push("/pages/login");
      
    } catch (error: any) {
      console.error("Signup failed:", error);
      setErrorMessage(error.message || "Signup failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleError = (error: Error) => {
    setErrorMessage(`Google signup failed: ${error.message}`);
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-start justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-indigo-600 py-6 px-8 text-center">
            <h1 className="text-3xl font-bold text-white">Create Account</h1>
          </div>

          {/* Step indicator */}
          <div className="px-8 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentStep === SignupStep.INITIAL_INFO
                      ? "bg-indigo-600 text-white"
                      : "bg-indigo-100 text-indigo-600"
                  }`}
                >
                  1
                </div>
                <span className="text-xs mt-1">Information</span>
              </div>
              <div
                className={`h-1 flex-grow mx-2 ${
                  currentStep === SignupStep.INITIAL_INFO
                    ? "bg-gray-200"
                    : "bg-indigo-400"
                }`}
              />
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentStep === SignupStep.OTP_VERIFICATION
                      ? "bg-indigo-600 text-white"
                      : currentStep === SignupStep.COMPLETE_SIGNUP
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  2
                </div>
                <span className="text-xs mt-1">Verification</span>
              </div>
              <div
                className={`h-1 flex-grow mx-2 ${
                  currentStep === SignupStep.COMPLETE_SIGNUP
                    ? "bg-indigo-400"
                    : "bg-gray-200"
                }`}
              />
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentStep === SignupStep.COMPLETE_SIGNUP
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  3
                </div>
                <span className="text-xs mt-1">Complete</span>
              </div>
            </div>
          </div>

          {/* Error and success messages */}
          <div className="px-8">
            {errorMessage && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-700">{successMessage}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Initial Information Form */}
          {currentStep === SignupStep.INITIAL_INFO && (
            <form
              onSubmit={initialFormik.handleSubmit}
              className="p-8 pb-4 space-y-2"
            >
              <div className="mb-4">
                <label
                  htmlFor="avatar"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Profile Picture (Optional)
                </label>
                <div className="flex items-center mt-2">
                  <div className="w-16 h-16 mr-4 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center border border-gray-300">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserIcon className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      id="avatar"
                      name="avatar"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                    <label
                      htmlFor="avatar"
                      className="flex items-center px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                    >
                      <PhotoIcon className="h-5 w-5 text-gray-400 mr-2" />
                      {avatarPreview ? "Change Picture" : "Upload Picture"}
                    </label>
                    {avatarFile && (
                      <p className="mt-1 text-sm text-gray-500">
                        {avatarFile.name.length > 20
                          ? `${avatarFile.name.substring(0, 20)}...`
                          : avatarFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    First Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      onChange={initialFormik.handleChange}
                      onBlur={initialFormik.handleBlur}
                      value={initialFormik.values.firstName}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="John"
                    />
                  </div>
                  {initialFormik.touched.firstName &&
                    initialFormik.errors.firstName && (
                      <p className="mt-1 text-sm text-red-600">
                        {initialFormik.errors.firstName}
                      </p>
                    )}
                </div>

                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Last Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      onChange={initialFormik.handleChange}
                      onBlur={initialFormik.handleBlur}
                      value={initialFormik.values.lastName}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Doe"
                    />
                  </div>
                  {initialFormik.touched.lastName &&
                    initialFormik.errors.lastName && (
                      <p className="mt-1 text-sm text-red-600">
                        {initialFormik.errors.lastName}
                      </p>
                    )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    onChange={initialFormik.handleChange}
                    onBlur={initialFormik.handleBlur}
                    value={initialFormik.values.email}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="you@example.com"
                  />
                </div>
                {initialFormik.touched.email && initialFormik.errors.email && (
                  <p className="mt-1 text-sm text-red-600">
                    {initialFormik.errors.email}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    onChange={(e) => {
                      initialFormik.handleChange(e);
                      calculatePasswordStrength(e.target.value);
                    }}
                    onBlur={initialFormik.handleBlur}
                    value={initialFormik.values.password}
                    className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                    )}
                  </button>
                </div>
                <div className="mt-2 flex space-x-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${
                        i <= passwordStrength
                          ? i === 1
                            ? "bg-red-400"
                            : i === 2
                            ? "bg-yellow-400"
                            : i === 3
                            ? "bg-blue-400"
                            : "bg-green-400"
                          : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                {initialFormik.touched.password &&
                  initialFormik.errors.password && (
                    <p className="mt-1 text-sm text-red-600">
                      {initialFormik.errors.password}
                    </p>
                  )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    onChange={initialFormik.handleChange}
                    onBlur={initialFormik.handleBlur}
                    value={initialFormik.values.confirmPassword}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="••••••••"
                  />
                </div>
                {initialFormik.touched.confirmPassword &&
                  initialFormik.errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">
                      {initialFormik.errors.confirmPassword}
                    </p>
                  )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-75"
                >
                  {isSubmitting ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    "Continue"
                  )}
                </button>
              </div>
            </form>
          )}

          {/* OTP Verification Form */}
          {currentStep === SignupStep.OTP_VERIFICATION && (
            <form onSubmit={otpFormik.handleSubmit} className="p-8 space-y-4">
              <div className="text-center mb-4">
                <p className="text-gray-600">
                  We've sent a verification code to
                  <br />
                  <span className="font-medium text-gray-900">
                    {initialFormik.values.email}
                  </span>
                </p>
              </div>

              <div>
                <label
                  htmlFor="otp"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Verification Code (OTP)
                </label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  maxLength={6}
                  onChange={otpFormik.handleChange}
                  onBlur={otpFormik.handleBlur}
                  value={otpFormik.values.otp}
                  className="block w-full py-2 px-3 text-center tracking-widest text-lg border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="123456"
                />
                {otpFormik.touched.otp && otpFormik.errors.otp && (
                  <p className="mt-1 text-sm text-red-600">
                    {otpFormik.errors.otp}
                  </p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-75"
                >
                  {isSubmitting ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify OTP"
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between mt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep(SignupStep.INITIAL_INFO)}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  &larr; Back
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendDisabled}
                  className={`text-sm ${
                    resendDisabled
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-indigo-600 hover:text-indigo-500"
                  }`}
                >
                  {resendDisabled ? `Resend in ${countdown}s` : "Resend OTP"}
                </button>
              </div>
            </form>
          )}

          {/* Complete Signup */}
          {currentStep === SignupStep.COMPLETE_SIGNUP && (
            <div className="p-8 space-y-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mt-3 text-lg font-medium text-gray-900">
                  Email Verified!
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Your email has been successfully verified. Click the button
                  below to complete your registration.
                </p>
              </div>

              <div className="flex flex-col space-y-4">
                <button
                  type="button"
                  onClick={completeSignup}
                  disabled={isSubmitting}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-75"
                >
                  {isSubmitting ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Complete Registration"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(SignupStep.OTP_VERIFICATION)}
                  className="text-sm text-indigo-600 hover:text-indigo-500 text-center"
                >
                  &larr; Back to verification
                </button>
              </div>
            </div>
          )}
          <div className="mt-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="mt-2">
              <GoogleAuthButton
                text="Sign up with Google"
                onError={handleGoogleError}
              />
            </div>
          </div>
          <div className="px-8 pb-6 text-center mt-2">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <a
                href="/pages/login"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Sign in
              </a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
