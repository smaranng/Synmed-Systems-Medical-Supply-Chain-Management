# Medical Supply Chain Website - Implementation Plan

## Project Overview
Building a comprehensive medical supply chain management system with role-based authentication supporting 4 user types: Pharmacies, distributors, Admins, and Customers.

## Color Theme
- Dark Navy Blue: #0A1D37 (headers, navbar, backgrounds)
- Light Blue: #4BA3C3 (buttons, links, highlights)
- Medical Green: #3BB273 (success states, CTAs)
- Soft White: #F9FAFB (backgrounds, cards)
- Grey Neutral: #6B7280 (text, borders)
- Alert Red: #E63946 (errors, warnings)

## Core Files to Create/Modify

### 1. Authentication & Layout Files
- [ ] `src/lib/auth.ts` - Authentication utilities and role management
- [ ] `src/components/layout/Header.tsx` - Main navigation header
- [ ] `src/components/layout/Sidebar.tsx` - Role-based sidebar navigation
- [ ] `src/components/auth/LoginForm.tsx` - Universal login form
- [ ] `src/pages/Login.tsx` - Login page

### 2. Dashboard Components
- [ ] `src/components/dashboard/StatsCard.tsx` - Reusable statistics card
- [ ] `src/components/dashboard/Chart.tsx` - Chart components for analytics
- [ ] `src/components/dashboard/DataTable.tsx` - Reusable data table

### 3. Pharmacy Portal (4 pages)
- [ ] `src/pages/pharmacy/Dashboard.tsx` - Statistics and overview
- [ ] `src/pages/pharmacy/Inventory.tsx` - Inventory management
- [ ] `src/pages/pharmacy/Orders.tsx` - Auto-reorder system
- [ ] `src/pages/pharmacy/ICN.tsx` - Inter-Clinic Network

### 4. distributor Portal (2 pages)
- [ ] `src/pages/distributor/Dashboard.tsx` - Order management dashboard
- [ ] `src/pages/distributor/Inventory.tsx` - Stock updates

### 5. Admin Portal (3 pages)
- [ ] `src/pages/admin/Dashboard.tsx` - Order tracking dashboard
- [ ] `src/pages/admin/Logistics.tsx` - Logistics tracking
- [ ] `src/pages/admin/Users.tsx` - User management

### 6. Customer Portal (2 pages)
- [ ] `src/pages/customer/Search.tsx` - Medicine search
- [ ] `src/pages/customer/Orders.tsx` - Order history and tracking

### 7. Data & Utilities
- [ ] `src/lib/mockData.ts` - Mock data for all entities
- [ ] `src/lib/localStorage.ts` - LocalStorage utilities
- [ ] `src/types/index.ts` - TypeScript interfaces

### 8. Update Core Files
- [ ] Update `src/App.tsx` - Add routing for all portals
- [ ] Update `index.html` - Update title and meta tags
- [ ] Update `src/index.css` - Add custom CSS variables for theme

## Implementation Strategy
1. Start with authentication system and basic layout
2. Create reusable dashboard components
3. Implement each portal with mock data
4. Add responsive design and interactions
5. Test all user flows and fix issues

## Key Features Per Portal
- **Pharmacy**: Statistics charts, inventory table, auto-reorder alerts, ICN marketplace
- **distributor**: Order list, fulfillment tracking, stock upload
- **Admin**: System overview, logistics map, user management
- **Customer**: Medicine search, pharmacy finder, order placement

Total estimated files: 20+ components and pages