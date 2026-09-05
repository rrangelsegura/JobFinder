import { createBrowserRouter, Navigate } from "react-router-dom"
import { LoginPage } from "@/features/auth/LoginPage"
import { RegisterPage } from "@/features/auth/RegisterPage"
import { VerifyEmailPage } from "@/features/auth/VerifyEmailPage"
import { WorkspaceLayout } from "@/features/workspace/WorkspaceLayout"
import { UploadPage } from "@/features/upload/UploadPage"
import { AnalysisResultsPage } from "@/features/analysis/AnalysisResultsPage"
import { ProtectedRoute } from "./ProtectedRoute"

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/workspace/upload" replace /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  // Outside ProtectedRoute: reachable both by an authenticated-but-
  // unverified candidate (redirected here) and by an unauthenticated visitor
  // who just clicked the link in their email (no session yet).
  { path: "/verify-email", element: <VerifyEmailPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/workspace",
        element: <WorkspaceLayout />,
        children: [
          { index: true, element: <Navigate to="upload" replace /> },
          { path: "upload", element: <UploadPage /> },
          { path: "analysis", element: <AnalysisResultsPage /> },
        ],
      },
    ],
  },
])
