"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.")
        return
      }

      router.push(data.redirectTo ?? "/")
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#F8F9F9" }}
    >
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8">
        {/* App name */}
        <h1 className="text-xl font-bold text-gray-900 mb-6 text-center tracking-tight">
          TDHC Desk
        </h1>

        {/* Error banner */}
        {error && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-5 text-sm"
            style={{ backgroundColor: "#FFF0F0", color: "#CC3340" }}
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 rounded-lg border px-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2"
              style={{
                borderColor: "#D8DCDE",
                // focus ring via inline style isn't possible; handled via Tailwind class below
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#038153"
                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(3,129,83,0.2)"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#D8DCDE"
                e.currentTarget.style.boxShadow = "none"
              }}
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 rounded-lg border px-3 pr-10 text-sm text-gray-900 placeholder-gray-400 outline-none transition"
                style={{ borderColor: "#D8DCDE" }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#038153"
                  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(3,129,83,0.2)"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#D8DCDE"
                  e.currentTarget.style.boxShadow = "none"
                }}
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-opacity flex items-center justify-center gap-2 mt-2"
            style={{
              backgroundColor: "#038153",
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
