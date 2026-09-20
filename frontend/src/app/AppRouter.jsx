import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { HomePage } from '../pages/HomePage.jsx'
import { NotFoundPage } from '../pages/NotFoundPage.jsx'
import { PendingPage } from '../pages/PendingPage.jsx'
import { AdminPendingPage } from '../pages/ScopedPendingPage.jsx'
import { ProtectedRoute, PublicOnlyRoute } from '../features/auth/ProtectedRoute.jsx'
import { AdminPublicOnlyRoute, AdminRoute } from '../features/admin-auth/AdminRoute.jsx'

const LoginPage = lazy(() => import('../features/auth/pages/LoginPage.jsx').then((module) => ({ default: module.LoginPage })))
const RegisterPage = lazy(() => import('../features/auth/pages/RegisterPage.jsx').then((module) => ({ default: module.RegisterPage })))
const VerifyEmailPage = lazy(() => import('../features/auth/pages/VerifyEmailPage.jsx').then((module) => ({ default: module.VerifyEmailPage })))
const ForgotPasswordPage = lazy(() => import('../features/auth/pages/ForgotPasswordPage.jsx').then((module) => ({ default: module.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('../features/auth/pages/ResetPasswordPage.jsx').then((module) => ({ default: module.ResetPasswordPage })))
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage.jsx').then((module) => ({ default: module.DashboardPage })))
const ProfilePage = lazy(() => import('../features/account/ProfilePage.jsx').then((module) => ({ default: module.ProfilePage })))
const WalletPage = lazy(() => import('../features/wallet/WalletPage.jsx').then((module) => ({ default: module.WalletPage })))
const DepositsPage = lazy(() => import('../features/deposits/DepositsPage.jsx').then((module) => ({ default: module.DepositsPage })))
const DepositDetailPage = lazy(() => import('../features/deposits/DepositDetailPage.jsx').then((module) => ({ default: module.DepositDetailPage })))
const CreateDepositPage = lazy(() => import('../features/deposits/CreateDepositPage.jsx').then((module) => ({ default: module.CreateDepositPage })))
const WithdrawalsPage = lazy(() => import('../features/withdrawals/WithdrawalsPage.jsx').then((module) => ({ default: module.WithdrawalsPage })))
const WithdrawalDetailPage = lazy(() => import('../features/withdrawals/WithdrawalDetailPage.jsx').then((module) => ({ default: module.WithdrawalDetailPage })))
const CreateWithdrawalPage = lazy(() => import('../features/withdrawals/CreateWithdrawalPage.jsx').then((module) => ({ default: module.CreateWithdrawalPage })))
const BetsPage = lazy(() => import('../features/bets/BetsPage.jsx').then((module) => ({ default: module.BetsPage })))
const BetDetailPage = lazy(() => import('../features/bets/BetDetailPage.jsx').then((module) => ({ default: module.BetDetailPage })))
const BetReceiptPage = lazy(() => import('../features/bets/BetReceiptPage.jsx').then((module) => ({ default: module.BetReceiptPage })))
const CreateBetPage = lazy(() => import('../features/bets/CreateBetPage.jsx').then((module) => ({ default: module.CreateBetPage })))
const AdminLoginPage = lazy(() => import('../features/admin-auth/AdminLoginPage.jsx').then((module) => ({ default: module.AdminLoginPage })))
const AdminDashboardPage = lazy(() => import('../features/admin/AdminDashboardPage.jsx').then((module) => ({ default: module.AdminDashboardPage })))
const AdminUsersPage = lazy(() => import('../features/admin/AdminUsersPage.jsx').then((module) => ({ default: module.AdminUsersPage })))
const AdminKycPage = lazy(() => import('../features/admin/AdminKycPage.jsx').then((module) => ({ default: module.AdminKycPage })))
const AdminDepositsPage = lazy(() => import('../features/admin/AdminDepositsPage.jsx').then((module) => ({ default: module.AdminDepositsPage })))
const AdminDepositDestinationsPage = lazy(() => import('../features/admin/AdminDepositDestinationsPage.jsx').then((module) => ({ default: module.AdminDepositDestinationsPage })))
const AdminWithdrawalsPage = lazy(() => import('../features/admin/AdminWithdrawalsPage.jsx').then((module) => ({ default: module.AdminWithdrawalsPage })))
const AdminDrawsPage = lazy(() => import('../features/admin/AdminDrawsPage.jsx').then((module) => ({ default: module.AdminDrawsPage })))
const AdminDrawListPage = lazy(() => import('../features/admin/AdminDrawListPage.jsx').then((module) => ({ default: module.AdminDrawListPage })))
const AdminLimitsPage = lazy(() => import('../features/admin/AdminLimitsPage.jsx').then((module) => ({ default: module.AdminLimitsPage })))
const AdminRulesPage = lazy(() => import('../features/admin/AdminRulesPage.jsx').then((module) => ({ default: module.AdminRulesPage })))
const AdminPayoutRulesPage = lazy(() => import('../features/admin/AdminPayoutRulesPage.jsx').then((module) => ({ default: module.AdminPayoutRulesPage })))
const AdminBetsPage = lazy(() => import('../features/admin/AdminBetsPage.jsx').then((module) => ({ default: module.AdminBetsPage })))
const AdminBetDetailPage = lazy(() => import('../features/admin/AdminBetDetailPage.jsx').then((module) => ({ default: module.AdminBetDetailPage })))
const AdminBetReceiptPage = lazy(() => import('../features/admin/AdminBetReceiptPage.jsx').then((module) => ({ default: module.AdminBetReceiptPage })))
const AdminAdminsPage = lazy(() => import('../features/admin/AdminAdminsPage.jsx').then((module) => ({ default: module.AdminAdminsPage })))

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<main className="app-background grid min-h-screen place-items-center" role="status"><LoaderCircle className="animate-spin text-electric-400" size={30} aria-hidden="true" /><span className="sr-only">Cargando pantalla</span></main>}>
        <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/registro" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
        <Route path="/verificar-correo" element={<PublicOnlyRoute><VerifyEmailPage /></PublicOnlyRoute>} />
        <Route path="/olvide-contrasena" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
        <Route path="/restablecer-contrasena" element={<PublicOnlyRoute><ResetPasswordPage /></PublicOnlyRoute>} />
        <Route path="/ayuda" element={<PendingPage title="Centro de ayuda en preparación" description="La ayuda crecerá con cada flujo funcional para reflejar el comportamiento real de la plataforma." />} />
        <Route path="/app" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/app/jugar" element={<ProtectedRoute><CreateBetPage /></ProtectedRoute>} />
        <Route path="/app/billetera" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="/app/depositos" element={<ProtectedRoute><DepositsPage /></ProtectedRoute>} />
        <Route path="/app/depositos/nuevo" element={<ProtectedRoute><CreateDepositPage /></ProtectedRoute>} />
        <Route path="/app/depositos/:id" element={<ProtectedRoute><DepositDetailPage /></ProtectedRoute>} />
        <Route path="/app/retiros" element={<ProtectedRoute><WithdrawalsPage /></ProtectedRoute>} />
        <Route path="/app/retiros/nuevo" element={<ProtectedRoute><CreateWithdrawalPage /></ProtectedRoute>} />
        <Route path="/app/retiros/:id" element={<ProtectedRoute><WithdrawalDetailPage /></ProtectedRoute>} />
        <Route path="/app/tickets" element={<ProtectedRoute><BetsPage /></ProtectedRoute>} />
        <Route path="/app/tickets/:id" element={<ProtectedRoute><BetDetailPage /></ProtectedRoute>} />
        <Route path="/app/tickets/:id/comprobante" element={<ProtectedRoute><BetReceiptPage /></ProtectedRoute>} />
        <Route path="/app/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/admin/login" element={<AdminPublicOnlyRoute><AdminLoginPage /></AdminPublicOnlyRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        <Route path="/admin/usuarios" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route path="/admin/kyc" element={<AdminRoute><AdminKycPage /></AdminRoute>} />
        <Route path="/admin/depositos" element={<AdminRoute><AdminDepositsPage /></AdminRoute>} />
        <Route path="/admin/destinos-deposito" element={<AdminRoute roles={['SUPER_ADMIN']}><AdminDepositDestinationsPage /></AdminRoute>} />
        <Route path="/admin/retiros" element={<AdminRoute><AdminWithdrawalsPage /></AdminRoute>} />
        <Route path="/admin/sorteos" element={<AdminRoute><AdminDrawsPage /></AdminRoute>} />
        <Route path="/admin/lista" element={<AdminRoute><AdminDrawListPage /></AdminRoute>} />
        <Route path="/admin/sorteos/:id/limites" element={<AdminRoute roles={['SUPER_ADMIN']}><AdminLimitsPage /></AdminRoute>} />
        <Route path="/admin/reglas" element={<AdminRoute roles={['SUPER_ADMIN']}><AdminRulesPage /></AdminRoute>} />
        <Route path="/admin/multiplicadores" element={<AdminRoute roles={['SUPER_ADMIN']}><AdminPayoutRulesPage /></AdminRoute>} />
        <Route path="/admin/apuestas" element={<AdminRoute><AdminBetsPage /></AdminRoute>} />
        <Route path="/admin/apuestas/:id" element={<AdminRoute><AdminBetDetailPage /></AdminRoute>} />
        <Route path="/admin/apuestas/:id/comprobante" element={<AdminRoute><AdminBetReceiptPage /></AdminRoute>} />
        <Route path="/admin/administradores" element={<AdminRoute roles={['SUPER_ADMIN']}><AdminAdminsPage /></AdminRoute>} />
        <Route path="/admin/*" element={<AdminRoute><AdminPendingPage title="Ruta administrativa no encontrada" description="La dirección solicitada no pertenece al panel administrativo." /></AdminRoute>} />
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
