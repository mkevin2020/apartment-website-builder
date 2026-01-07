# Language Support Implementation

## Overview
The website now supports English (EN) and Arabic (AR) with RTL (Right-to-Left) support for Arabic.

## How to Use

### 1. **Language Switcher in Header**
- Located in the main site header (visible on all public pages)
- Desktop: Appears in the navigation bar
- Mobile: Available in the mobile menu
- Persists user choice in localStorage

### 2. **Using Translations in Components**

```tsx
"use client"
import { useLanguage } from "@/lib/language-context"

export function MyComponent() {
  const { language, t } = useLanguage()

  return (
    <div>
      <h1>{t("apartments.title")}</h1>
      <p>{t("apartments.subtitle")}</p>
      <p>Current Language: {language}</p>
    </div>
  )
}
```

### 3. **Features**
✅ **Automatic RTL Support** - Arabic text automatically switches to RTL
✅ **Persistent Language** - User's choice saved to localStorage
✅ **Dynamic Updates** - All components update immediately when language changes
✅ **Hydration Safe** - Uses `mounted` state to prevent hydration mismatches

## Available Translation Keys

### Navigation
- `nav.home` - Home
- `nav.apartments` - Apartments
- `nav.booking` - Booking
- `nav.feedback` - Feedback
- `nav.login` - Login
- `nav.language` - Language

### Apartments Section
- `apartments.title` - Luxury Apartments
- `apartments.subtitle` - Find your perfect home
- `apartments.price` - Price per Month
- `apartments.bedrooms` - Bedrooms
- `apartments.bathrooms` - Bathrooms
- `apartments.size` - Size
- `apartments.viewDetails` - View Details
- `apartments.bookNow` - Book Now
- `apartments.available` - Available
- `apartments.notAvailable` - Not Available

### Booking
- `booking.title` - Book an Apartment
- `booking.fullName` - Full Name
- `booking.email` - Email
- `booking.phone` - Phone
- `booking.apartmentType` - Apartment Type
- `booking.checkIn` - Check-in Date
- `booking.checkOut` - Check-out Date
- `booking.submit` - Submit Booking
- `booking.success` - Booking submitted successfully!
- `booking.error` - Error submitting booking

### Feedback
- `feedback.title` - Send us Feedback
- `feedback.name` - Your Name
- `feedback.message` - Your Message
- `feedback.submit` - Submit Feedback
- `feedback.success` - Thank you for your feedback!
- `feedback.error` - Error submitting feedback

### Login
- `login.admin` - Admin Login
- `login.employee` - Employee Login
- `login.tenant` - Tenant Login
- `login.username` - Username
- `login.email` - Email
- `login.password` - Password
- `login.signIn` - Sign In
- `login.noAccount` - Don't have an account?
- `login.createAccount` - Create Account
- `login.backHome` - Back to Home

### Buttons
- `button.confirm` - Confirm
- `button.reject` - Reject
- `button.delete` - Delete
- `button.edit` - Edit
- `button.save` - Save
- `button.cancel` - Cancel
- `button.submit` - Submit
- `button.deleting` - Deleting...
- `button.loading` - Loading...

### Messages
- `message.deleteConfirm` - Are you sure?
- `message.deleteSuccess` - Deleted successfully!
- `message.deleteError` - Error deleting item
- `message.success` - Success!
- `message.error` - Error
- `message.required` - This field is required

### Tenant Dashboard
- `tenant.dashboard` - Dashboard
- `tenant.profile` - Profile
- `tenant.payments` - Payments
- `tenant.maintenance` - Maintenance
- `tenant.welcome` - Welcome back
- `tenant.apartment` - Your Apartment
- `tenant.lease` - Lease Information
- `tenant.status` - Payment Status

### Admin
- `admin.dashboard` - Dashboard
- `admin.apartments` - Apartments
- `admin.tenants` - Tenants
- `admin.employees` - Employees
- `admin.bookings` - Bookings
- `admin.feedback` - Feedback
- `admin.maintenance` - Maintenance

## Adding New Translations

To add new translations:

1. Open `/lib/language-context.tsx`
2. Add the key and translation to both `en` and `ar` objects in the `translations` constant
3. Use it in your component with `t("key")`

Example:
```tsx
const translations = {
  en: {
    "my.newKey": "My New Text",
  },
  ar: {
    "my.newKey": "نصي الجديد",
  },
}
```

## RTL Support
The language provider automatically:
- Sets `document.documentElement.dir = "rtl"` for Arabic
- Sets `document.documentElement.dir = "ltr"` for English
- Sets the language attribute on the HTML tag

No additional CSS needed for RTL - Tailwind CSS handles it automatically with the `dir` attribute.
