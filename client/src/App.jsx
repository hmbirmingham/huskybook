import { Routes, Route } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import FindACut from './pages/FindACut.jsx';
import ListYourself from './pages/ListYourself.jsx';
import MyRequests from './pages/MyRequests.jsx';
import ManageRequests from './pages/ManageRequests.jsx';
import SignIn from './pages/SignIn.jsx';
import VerifyLogin from './pages/VerifyLogin.jsx';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<FindACut />} />
          <Route path="/list" element={<ListYourself />} />
          <Route path="/my-requests" element={<MyRequests />} />
          <Route path="/manage" element={<ManageRequests />} />
          <Route path="/login" element={<SignIn />} />
          <Route path="/verify" element={<VerifyLogin />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
