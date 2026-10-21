import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Home from "./Screens/Home";
import Login from "./Screens/Login";
import CreateAccount from "./Screens/CreateAccount";
import { TopNav } from './components/layout'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Each page's code loads only when it's opened; Home, Login and sign-up stay in the first bundle
const Verify = lazy(() => import('./Screens/Verify'))
const Dashboard = lazy(() => import('./Screens/Dashboard'))
const EventsPage = lazy(() => import('./Screens/EventsPage'))
const AllEventsPage = lazy(() => import('./Screens/AllEventsPage'))
const CreateEvent = lazy(() => import('./Screens/CreateEvent'))
const GroupsPage = lazy(() => import('./Screens/GroupsPage'))
const CreateGroup = lazy(() => import('./Screens/CreateGroup'))
const Profile = lazy(() => import('./Screens/Profile'))
const PublicProfile = lazy(() => import('./Screens/PublicProfile'))
const EventDetail = lazy(() => import('./Screens/EventDetail'))
const GroupDetail = lazy(() => import('./Screens/GroupDetail'))

function AppRoutes() {
  const location = useLocation()
  const hideTop = location.pathname === '/login' || location.pathname === '/create-account'

  return (
    <>
      {!hideTop && <TopNav />}

      <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/events" element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
        <Route path="/events/all" element={<ProtectedRoute><AllEventsPage /></ProtectedRoute>} />
        <Route path="/events/create" element={<ProtectedRoute><CreateEvent /></ProtectedRoute>} />
        <Route path="/events/:id" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
        <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
        <Route path="/groups/create" element={<ProtectedRoute><CreateGroup /></ProtectedRoute>} />
        <Route path="/groups/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
        <Route path="/profile/:userRef" element={<PublicProfile />} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      </Routes>
      </Suspense>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
