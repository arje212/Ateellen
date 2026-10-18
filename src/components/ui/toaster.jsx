import { Toaster as SonnerToaster } from "sonner";

export function Toaster(props) {
  return (
    <SonnerToaster
      theme="dark"
      position="top-right"
      richColors
      closeButton
      {...props}
    />
  );
}