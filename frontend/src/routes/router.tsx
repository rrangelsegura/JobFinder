import { createBrowserRouter, Navigate } from "react-router-dom"
import { LoginPage } from "@/features/auth/LoginPage"
import { RegisterPage } from "@/features/auth/RegisterPage"
import { WorkspaceLayout } from "@/features/workspace/WorkspaceLayout"
import { UploadPage } from "@/features/upload/UploadPage"
import { ProtectedRoute } from "./ProtectedRoute"

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/workspace/upload" replace /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/workspace",
        element: <WorkspaceLayout />,
        children: [
          { index: true, element: <Navigate to="upload" replace /> },
          { path: "upload", element: <UploadPage /> },
        ],
      },
    ],
  },
])
