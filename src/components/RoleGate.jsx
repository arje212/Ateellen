import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

// Only lets the listed roles see a page; cashiers get sent to the POS.
export default function RoleGate({ roles = ["admin"], children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/admin/pos" replace />;
  return children;
}
