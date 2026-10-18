import { toast as sonnerToast } from "sonner";

function showToast({ title, description, variant, ...options } = {}) {
  const message = title || description || "";
  const toastOptions = {
    description: title ? description : undefined,
    ...options,
  };

  return variant === "destructive"
    ? sonnerToast.error(message, toastOptions)
    : sonnerToast(message, toastOptions);
}

export const toast = showToast;

export function useToast() {
  return { toast: showToast };
}