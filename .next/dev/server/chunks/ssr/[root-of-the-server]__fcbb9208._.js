module.exports = [
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[project]/lib/language-context.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LanguageProvider",
    ()=>LanguageProvider,
    "useLanguage",
    ()=>useLanguage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
const LanguageContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])(undefined);
const translations = {
    en: {
        // Navigation
        "nav.home": "Home",
        "nav.apartments": "Apartments",
        "nav.booking": "Booking",
        "nav.feedback": "Contact",
        "nav.login": "Login",
        "nav.language": "Language",
        // Header
        "header.welcome": "Welcome",
        "header.logout": "Logout",
        "header.changePassword": "Change Password",
        // Apartments
        "apartments.title": "Luxury Apartments",
        "apartments.subtitle": "Find your perfect home",
        "apartments.price": "Price per Month",
        "apartments.bedrooms": "Bedrooms",
        "apartments.bathrooms": "Bathrooms",
        "apartments.size": "Size",
        "apartments.viewDetails": "View Details",
        "apartments.bookNow": "Book Now",
        "apartments.available": "Available",
        "apartments.notAvailable": "Not Available",
        // Booking
        "booking.title": "Book an Apartment",
        "booking.fullName": "Full Name",
        "booking.email": "Email",
        "booking.phone": "Phone",
        "booking.apartmentType": "Apartment Type",
        "booking.checkIn": "Check-in Date",
        "booking.checkOut": "Check-out Date",
        "booking.submit": "Submit Booking",
        "booking.success": "Booking submitted successfully!",
        "booking.error": "Error submitting booking",
        // Feedback
        "feedback.title": "Send us Feedback",
        "feedback.name": "Your Name",
        "feedback.message": "Your Message",
        "feedback.submit": "Submit Feedback",
        "feedback.success": "Thank you for your feedback!",
        "feedback.error": "Error submitting feedback",
        // Login
        "login.admin": "Admin Login",
        "login.employee": "Employee Login",
        "login.tenant": "Tenant Login",
        "login.username": "Username",
        "login.email": "Email",
        "login.password": "Password",
        "login.signIn": "Sign In",
        "login.noAccount": "Don't have an account?",
        "login.createAccount": "Create Account",
        "login.backHome": "Back to Home",
        // Buttons
        "button.confirm": "Confirm",
        "button.reject": "Reject",
        "button.delete": "Delete",
        "button.edit": "Edit",
        "button.save": "Save",
        "button.cancel": "Cancel",
        "button.submit": "Submit",
        "button.deleting": "Deleting...",
        "button.loading": "Loading...",
        // Messages
        "message.deleteConfirm": "Are you sure you want to delete this?",
        "message.deleteSuccess": "Deleted successfully!",
        "message.deleteError": "Error deleting item",
        "message.success": "Success!",
        "message.error": "Error",
        "message.required": "This field is required",
        // Tenant Dashboard
        "tenant.dashboard": "Dashboard",
        "tenant.profile": "Profile",
        "tenant.payments": "Payments",
        "tenant.maintenance": "Maintenance",
        "tenant.welcome": "Welcome back",
        "tenant.apartment": "Your Apartment",
        "tenant.lease": "Lease Information",
        "tenant.status": "Payment Status",
        // Admin
        "admin.dashboard": "Dashboard",
        "admin.apartments": "Apartments",
        "admin.tenants": "Tenants",
        "admin.employees": "Employees",
        "admin.bookings": "Bookings",
        "admin.feedback": "Feedback",
        "admin.maintenance": "Maintenance"
    },
    ar: {
        // Navigation
        "nav.home": "الرئيسية",
        "nav.apartments": "الشقق",
        "nav.booking": "الحجز",
        "nav.feedback": "التقييمات",
        "nav.login": "دخول",
        "nav.language": "اللغة",
        // Header
        "header.welcome": "أهلا وسهلا",
        "header.logout": "تسجيل خروج",
        "header.changePassword": "تغيير كلمة المرور",
        // Apartments
        "apartments.title": "شقق فاخرة",
        "apartments.subtitle": "ابحث عن منزلك المثالي",
        "apartments.price": "السعر في الشهر",
        "apartments.bedrooms": "غرف النوم",
        "apartments.bathrooms": "الحمامات",
        "apartments.size": "الحجم",
        "apartments.viewDetails": "عرض التفاصيل",
        "apartments.bookNow": "احجز الآن",
        "apartments.available": "متاح",
        "apartments.notAvailable": "غير متاح",
        // Booking
        "booking.title": "احجز شقة",
        "booking.fullName": "الاسم الكامل",
        "booking.email": "البريد الإلكتروني",
        "booking.phone": "الهاتف",
        "booking.apartmentType": "نوع الشقة",
        "booking.checkIn": "تاريخ الدخول",
        "booking.checkOut": "تاريخ المغادرة",
        "booking.submit": "تقديم الحجز",
        "booking.success": "تم تقديم الحجز بنجاح!",
        "booking.error": "خطأ في تقديم الحجز",
        // Feedback
        "feedback.title": "أرسل لنا ملاحظاتك",
        "feedback.name": "اسمك",
        "feedback.message": "رسالتك",
        "feedback.submit": "إرسال الملاحظات",
        "feedback.success": "شكراً لملاحظاتك!",
        "feedback.error": "خطأ في إرسال الملاحظات",
        // Login
        "login.admin": "دخول المسؤول",
        "login.employee": "دخول الموظف",
        "login.tenant": "دخول المستأجر",
        "login.username": "اسم المستخدم",
        "login.email": "البريد الإلكتروني",
        "login.password": "كلمة المرور",
        "login.signIn": "دخول",
        "login.noAccount": "ليس لديك حساب؟",
        "login.createAccount": "إنشاء حساب",
        "login.backHome": "العودة للرئيسية",
        // Buttons
        "button.confirm": "تأكيد",
        "button.reject": "رفض",
        "button.delete": "حذف",
        "button.edit": "تعديل",
        "button.save": "حفظ",
        "button.cancel": "إلغاء",
        "button.submit": "تقديم",
        "button.deleting": "جاري الحذف...",
        "button.loading": "جاري التحميل...",
        // Messages
        "message.deleteConfirm": "هل أنت متأكد من رغبتك في حذف هذا؟",
        "message.deleteSuccess": "تم الحذف بنجاح!",
        "message.deleteError": "خطأ في حذف العنصر",
        "message.success": "نجح!",
        "message.error": "خطأ",
        "message.required": "هذا الحقل مطلوب",
        // Tenant Dashboard
        "tenant.dashboard": "لوحة التحكم",
        "tenant.profile": "الملف الشخصي",
        "tenant.payments": "المدفوعات",
        "tenant.maintenance": "الصيانة",
        "tenant.welcome": "أهلا وسهلا بك",
        "tenant.apartment": "شقتك",
        "tenant.lease": "معلومات الإيجار",
        "tenant.status": "حالة الدفع",
        // Admin
        "admin.dashboard": "لوحة التحكم",
        "admin.apartments": "الشقق",
        "admin.tenants": "المستأجرون",
        "admin.employees": "الموظفون",
        "admin.bookings": "الحجوزات",
        "admin.feedback": "الملاحظات",
        "admin.maintenance": "الصيانة"
    }
};
function LanguageProvider({ children }) {
    const [language, setLanguage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("en");
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const saved = localStorage.getItem("language");
        if (saved) setLanguage(saved);
        setMounted(true);
    }, []);
    const handleSetLanguage = (lang)=>{
        setLanguage(lang);
        localStorage.setItem("language", lang);
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    };
    const t = (key)=>{
        return translations[language][key] || key;
    };
    if (!mounted) return children;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(LanguageContext.Provider, {
        value: {
            language,
            setLanguage: handleSetLanguage,
            t
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/lib/language-context.tsx",
        lineNumber: 234,
        columnNumber: 5
    }, this);
}
function useLanguage() {
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within LanguageProvider");
    }
    return context;
}
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/dynamic-access-async-storage.external.js [external] (next/dist/server/app-render/dynamic-access-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/dynamic-access-async-storage.external.js", () => require("next/dist/server/app-render/dynamic-access-async-storage.external.js"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__fcbb9208._.js.map