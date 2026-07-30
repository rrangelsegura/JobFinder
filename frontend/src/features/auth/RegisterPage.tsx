import { useState, type FormEvent } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useRegister } from "./useAuth"

export function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const register = useRegister()
  const navigate = useNavigate()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    register.mutate(
      { email, password },
      { onSuccess: () => navigate("/login") },
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-3">
        <h1 className="text-xl font-semibold">Create your account</h1>
        <label htmlFor="register-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="register-password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {register.isError && (
          <p role="alert" className="text-sm text-destructive">
            {register.error.message}
          </p>
        )}
        <Button type="submit" disabled={register.isPending}>
          Register
        </Button>
        <Link to="/login" className="text-sm underline">
          Already have an account? Log in
        </Link>
      </form>
    </div>
  )
}
