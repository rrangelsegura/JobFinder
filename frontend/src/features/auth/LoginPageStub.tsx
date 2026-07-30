// Placeholder route target for unauthenticated redirects. The real
// LoginPage (form, mutation against POST /auth/login) is US-003's
// responsibility (see ai-specs/requests/US-003.md, "Files / Modules to
// Modify") — this change only needs a valid redirect destination to exist.
export function LoginPageStub() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">
        Login is not yet available. This page will be built as part of the
        candidate authentication story.
      </p>
    </div>
  )
}
