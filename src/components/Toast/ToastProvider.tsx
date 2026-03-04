 "use client";
 
 import React, { createContext, useContext, useCallback, useState } from "react";
 import styles from "./toast.module.css";
 
 type ToastType = "success" | "error" | "warning" | "info";
 
 interface ToastItem {
   id: string;
   message: string;
   type: ToastType;
 }
 
 interface ToastContextValue {
   show: (message: string, type?: ToastType, duration?: number) => void;
   success: (message: string, duration?: number) => void;
   error: (message: string, duration?: number) => void;
   warning: (message: string, duration?: number) => void;
   info: (message: string, duration?: number) => void;
 }
 
 const ToastContext = createContext<ToastContextValue | null>(null);
 
 export function ToastProvider({ children }: { children: React.ReactNode }) {
   const [toasts, setToasts] = useState<ToastItem[]>([]);
 
   const remove = useCallback((id: string) => {
     setToasts((prev) => prev.filter((t) => t.id !== id));
   }, []);
 
   const show = useCallback(
     (message: string, type: ToastType = "info", duration = 3000) => {
       const id = Math.random().toString(36).slice(2);
       setToasts((prev) => [...prev, { id, message, type }]);
       window.setTimeout(() => remove(id), duration);
     },
     [remove]
   );
 
   const success = useCallback((message: string, duration?: number) => show(message, "success", duration), [show]);
   const error = useCallback((message: string, duration?: number) => show(message, "error", duration), [show]);
   const warning = useCallback((message: string, duration?: number) => show(message, "warning", duration), [show]);
   const info = useCallback((message: string, duration?: number) => show(message, "info", duration), [show]);
 
   return (
     <ToastContext.Provider value={{ show, success, error, warning, info }}>
       {children}
       <div className={styles.container}>
         {toasts.map((t) => (
           <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
             {t.message}
           </div>
         ))}
       </div>
     </ToastContext.Provider>
   );
 }
 
 export function useToast() {
   const ctx = useContext(ToastContext);
   if (!ctx) throw new Error("useToast must be used within ToastProvider");
   return ctx;
 }
