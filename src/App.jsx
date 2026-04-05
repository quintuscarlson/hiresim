import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Live from "./pages/Live";
import TypedInterview from "./pages/TypedInterview";
import VoiceInterview from "./pages/VoiceInterview";
import VideoInterview from "./pages/VideoInterview";
import Debrief from "./pages/Debrief";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/live" element={<Live />} />
      <Route path="/interview/typed" element={<TypedInterview />} />
      <Route path="/interview/voice" element={<VoiceInterview />} />
      <Route path="/interview/video" element={<VideoInterview />} />
      <Route path="/debrief" element={<Debrief />} />
    </Routes>
  );
}