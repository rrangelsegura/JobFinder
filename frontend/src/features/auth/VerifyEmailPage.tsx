import { useEffect } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { useVerifyEmail, useResendVerification } from "./useAuth"
import { useSession } from "./useSession"

// candidate-email-verification: this one route serves two distinct visits —
// (1) the candidate clicked the link in the email (?token=... present, no
// active session required) and (2) ProtectedRoute redirected an
// authenticated-but-unverified candidate here (no token, has a session) —
// see design.md Decision 2 (requireAuth gate) and the holding-page note in
// its Impact section.
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")
  const verify = useVerifyEmail()
  const resend = useResendVerification()
  const { email } = useSession()

  useEffect(() => {
    if (token) {
      verify.mutate(token)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <h1 className="text-xl font-semibold">Verifying your email</h1>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {verify.isPending && <p role="status">Verifying your email…</p>}
            {verify.isSuccess && (
              <>
                <p role="status">Your email is verified.</p>
                <Link to="/login" className="text-sm text-muted-foreground underline">
                  Log in to continue
                </Link>
              </>
            )}
            {verify.isError && (
              <p role="alert" className="text-sm text-destructive">
                This link is invalid or has expired. Request a new one below.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-xl font-semibold">Verify your email</h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Check your inbox{email ? ` (${email})` : ""} for a verification link — you'll need it before you can use
            JobFinder.
          </p>
          <Button
            onClick={() => email && resend.mutate(email)}
            disabled={resend.isPending || !email}
          >
            Resend verification email
          </Button>
          {resend.isSuccess && (
            <p role="status" className="text-sm">
              If that email is registered and not yet verified, a new link has been sent.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
