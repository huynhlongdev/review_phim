/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Search, 
  Play, 
  Pause, 
  Volume2, 
  Film, 
  Star, 
  Loader2, 
  Mic2,
  ChevronRight,
  Download,
  Trash2,
  Sparkles,
  BookOpen,
  Heart,
  MessageCircle,
  Users,
  User,
  Globe,
  Smile,
  Laugh
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
// @ts-ignore
import lamejs from 'lamejs';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface MovieReview {
  title: string;
  content: string;
  rating: number;
  genre: string;
  year: string;
}

export default function App() {
  const [movieName, setMovieName] = useState('');
  const [movieContent, setMovieContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<MovieReview | null>(null);
  const [audioParts, setAudioParts] = useState<{ url: string, title: string }[]>([]);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsProgress, setTtsProgress] = useState(0);
  const [randomLoading, setRandomLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // New state variables
  const [selectedGenre, setSelectedGenre] = useState('tinh_yeu'); // 'hai_huoc' | 'tinh_yeu' | 'cha_me' | 'hoc_duong'
  const [voiceGender, setVoiceGender] = useState('nam'); // 'nam' | 'nu'
  const [themeSuggestionLoading, setThemeSuggestionLoading] = useState(false);

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const clearInputs = () => {
    setMovieName('');
    setMovieContent('');
    setReview(null);
    if (audioParts.length > 0) {
      audioParts.forEach(part => URL.revokeObjectURL(part.url));
      setAudioParts([]);
    }
  };

  const generateTopicSuggestion = async () => {
    setThemeSuggestionLoading(true);
    setError(null);
    try {
      const genreNames: Record<string, string> = {
        'hai_huoc': 'hài hước, vui nhộn, hóm hỉnh về cuộc sống hàng ngày hoặc động vật cưng tinh nghịch',
        'tinh_yeu': 'tình yêu đôi lứa lãng mạn, ngọt ngào hoặc những rung động nhẹ nhàng',
        'cha_me': 'tình cảm gia đình thiêng liêng, lòng biết ơn cha mẹ hoặc sự thấu hiểu giữa con cái và cha mẹ',
        'hoc_duong': 'kỷ niệm học trò tinh nghịch, tình bạn thanh xuân rực rỡ, thầy cô và trường lớp thân thương',
        'tieu_lam': 'truyện tiếu lâm dân gian, trạng cười hoặc truyện hài hước dí dỏm, châm biếm thông minh mang phong cách dân dã Việt Nam'
      };
      const genreName = genreNames[selectedGenre] || 'tình yêu';
      const prompt = `Bạn là một biên tập viên radio tài năng. Hãy gợi ý một chủ đề truyện mô tả ngắn gọn khoảng 1-2 câu để viết một câu chuyện phát thanh thuộc thể loại "${genreName}". Chủ đề phải gần gũi, dí dỏm hoặc sâu lắng tùy theo thể loại, đong đầy cảm xúc và cực kỳ lôi cuốn người nghe. Hãy sáng tạo ngẫu nhiên một ý tưởng độc đáo, mới mẻ. Chỉ trả về duy nhất câu gợi ý đó, không thêm bất kỳ tiêu đề, nhãn hay lời giải thích nào khác.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });
      
      const suggestion = (response.text || '').trim().replace(/^"|"$/g, '');
      setMovieName(suggestion);
    } catch (error: any) {
      console.error("Error generating theme suggestion:", error);
      setError("Không thể gợi ý chủ đề tự động. Bạn có thể tự nhập ý tưởng của mình.");
    } finally {
      setThemeSuggestionLoading(false);
    }
  };

  const generateStoryFromDescription = async () => {
    if (!movieName.trim()) {
      setError("Vui lòng nhập mô tả câu chuyện hoặc chọn 'Gợi ý chủ đề' trước khi tạo.");
      return;
    }
    setRandomLoading(true);
    setError(null);
    
    try {
      const genreNames: Record<string, string> = {
        'hai_huoc': 'hài hước, vui nhộn, hóm hỉnh',
        'tinh_yeu': 'tình yêu đôi lứa, lãng mạn, ngọt ngào',
        'cha_me': 'tình cảm gia đình, tình cha mẹ và con cái ấm áp, cảm động',
        'hoc_duong': 'chuyện học đường, tình bạn tuổi học trò thanh xuân tinh nghịch',
        'tieu_lam': 'tiếu lâm, truyện cười dân gian dóm dỉnh, hài hước châm biếm thông minh và hóm hỉnh của Việt Nam'
      };
      const genreText = genreNames[selectedGenre] || 'truyện kể radio';

      const prompt = `Bạn là một nhà văn chuyên viết truyện ngắn phát thanh xuất sắc, giàu cảm xúc. Hãy viết một câu chuyện thuộc thể loại "${genreText}" dựa trên MÔ TẢ/Ý TƯỞNG sau: "${movieName}"

## YÊU CẦU ĐẶC BIỆT VỀ ĐỘ DÀI (QUAN TRỌNG NHẤT):
- **Độ dài tổng cộng**: Phải nằm trong khoảng **400 đến 500 từ** (không viết ngắn quá và tuyệt đối không viết dài quá 500 từ). Độ dài này rất quan trọng để đảm bảo thời lượng đọc của radio kéo dài khoảng từ **3 đến 4 phút** với tốc độ đọc truyền cảm tự nhiên.

## NHÂN VẬT & BỐI CẢNH (YÊU CẦU NGẪU NHIÊN):
- **Bắt buộc đặt tên nhân vật NGẪU NHIÊN và ĐA DẠNG**: Tránh dùng đi dùng lại các tên quá phổ biến như Nam, Vy. Hãy chọn ngẫu nhiên các tên thuần Việt độc đáo, phù hợp cho 1-2 nhân vật chính (ví dụ: chú Út, thím Năm, ông đồ Sắn, anh Gù, bé Mận, lý trưởng, xã trưởng, Trạng cười, tú tài, Kiên, Hùng, Thảo, Hương, Kha, Đan, Giang, Bình, v.v.).
- Xây dựng bối cảnh sinh động của Việt Nam phù hợp nhất với thể loại được chọn:
  * Nếu là **Tiếu lâm**: Lấy bối cảnh làng quê Việt Nam xưa (ao làng, đình làng, chợ phiên) hoặc tình huống trớ trêu, dở khóc dở cười thời hiện đại để tạo tiếng cười dân dã, trào phúng vui vẻ.
  * Nếu là các thể loại khác: Bối cảnh ấm áp, gần gũi, giàu cảm xúc.

## CẤU TRÚC TRUYỆN:
- Viết thành **3 đoạn văn** rõ ràng, cân đối về mặt độ dài. Mỗi đoạn văn sẽ được đọc ở một phần radio riêng biệt.
- **Đoạn 1**: Mở đầu dẫn dắt người nghe, khơi gợi cảm hứng và giới thiệu hoàn cảnh.
- **Đoạn 2**: Diễn biến chính, có nút thắt/cao trào hoặc tình tiết đáng chú ý của câu chuyện.
- **Đoạn 3**: Giải quyết vấn đề nhẹ nhàng, kết thúc lắng đọng, truyền tải thông điệp sâu sắc và chạm tới trái tim người nghe.

## PHONG CÁCH VIẾT:
✓ **Giọng văn**: Chậm rãi, sâu lắng, mang màu sắc tâm sự trữ tình và lôi cuốn người nghe.
✓ **Câu văn**: Viết câu hoàn chỉnh trọn vẹn, chấm câu rõ ràng (. ! ?). Đảm bảo kết thúc ở cuối mỗi đoạn văn là một câu trọn vẹn (không bị lửng lơ).
✓ **Từ ngữ**: Trong sáng, giàu chất thơ, thuần Việt, phù hợp với giọng nói phát thanh.
✓ **Cảm xúc**: Tự nhiên, chân thành, tránh sáo rỗng hay gượng gạo.

## LƯU Ý NGHIÊM NGẶT:
- KHÔNG sử dụng các tiêu đề phụ như "Đoạn 1", "Mở đầu", "Kết thúc" hay chia nhỏ thành các mục. Chỉ viết thuần văn xuôi thành 3 đoạn văn liền kề nhau.
- KHÔNG viết hội thoại quá dài hay đối đáp liên tục. Chủ yếu dùng lời kể dẫn chuyện (storytelling).

Bắt đầu câu chuyện ngay bây giờ:`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      const story = response.text || '';
      setMovieContent(story);
      setReview(null); // Clear previous review if any
    } catch (error: any) {
      console.error("Error generating story:", error);
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        setError("Hệ thống đang quá tải (hết lượt dùng thử). Vui lòng thử lại sau vài phút hoặc đổi chủ đề khác.");
      } else {
        setError("Có lỗi xảy ra khi tạo truyện. Vui lòng thử lại.");
      }
    } finally {
      setRandomLoading(false);
    }
  };

  const generateTTS = async (customText?: string) => {
    const text = customText || movieContent;
    if (!text) return;
    setTtsLoading(true);
    setTtsProgress(0);
    setError(null);

    // Clear old parts
    audioParts.forEach(part => URL.revokeObjectURL(part.url));
    setAudioParts([]);

    // Robust sentence splitting at boundary (. ! ?) preserving original punctuation
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const totalSentences = sentences.length;
    
    let textParts: string[] = [];
    if (totalSentences <= 3) {
      textParts = sentences.map(s => s.trim());
    } else {
      const partSize = Math.ceil(totalSentences / 3);
      textParts = [
        sentences.slice(0, partSize).join(' ').trim(),
        sentences.slice(partSize, partSize * 2).join(' ').trim(),
        sentences.slice(partSize * 2).join(' ').trim()
      ].filter(p => p.length > 0);
    }

    const progressInterval = setInterval(() => {
      setTtsProgress(prev => {
        if (prev >= 95) return prev;
        return prev + 2;
      });
    }, 500);

    try {
      const newParts: { url: string, title: string }[] = [];
      const selectedVoice = voiceGender === 'nam' ? 'Puck' : 'Kore';

      for (let i = 0; i < textParts.length; i++) {
        const partText = textParts[i];
        // Ensure synchronized tone, pace and voice characteristics for a consistent blog radio flow
        const prompt = `Bạn là một phát thanh viên radio giọng ${voiceGender === 'nam' ? 'Nam trầm ấm, truyền cảm, cuốn hút' : 'Nữ dịu dàng, ngọt ngào, sâu lắng'}. Hãy đọc đoạn văn sau bằng tiếng Việt với chất giọng hoàn toàn đồng bộ, nhất quán, nhịp điệu phát thanh tự nhiên, trôi chảy, không có tạp âm hay vang vọng: ${partText}`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        const decodedChunks: Uint8Array[] = [];
        let totalByteLength = 0;

        for (const part of parts) {
          if (part.inlineData?.data) {
            const sanitizedBase64 = part.inlineData.data.replace(/\s/g, '');
            const binaryString = atob(sanitizedBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) {
              bytes[j] = binaryString.charCodeAt(j);
            }
            decodedChunks.push(bytes);
            totalByteLength += bytes.length;
          }
        }

        if (decodedChunks.length > 0) {
          const combinedBytes = new Uint8Array(totalByteLength);
          let offset = 0;
          for (const chunk of decodedChunks) {
            combinedBytes.set(chunk, offset);
            offset += chunk.length;
          }

          // Convert to MP3
          try {
            const pcmLength = Math.floor(combinedBytes.length / 2);
            const int16Samples = new Int16Array(combinedBytes.buffer, combinedBytes.byteOffset, pcmLength);
            const lame = (lamejs as any).default || lamejs;
            const mp3encoder = new lame.Mp3Encoder(1, 24000, 128);
            const mp3Data: Uint8Array[] = [];
            
            const chunkSize = 1152 * 10;
            for (let j = 0; j < int16Samples.length; j += chunkSize) {
              const chunk = int16Samples.subarray(j, j + chunkSize);
              const mp3buf = mp3encoder.encodeBuffer(chunk);
              if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf));
            }
            
            const mp3Final = mp3encoder.flush();
            if (mp3Final.length > 0) mp3Data.push(new Uint8Array(mp3Final));
            
            const blob = new Blob(mp3Data, { type: 'audio/mp3' });
            newParts.push({ url: URL.createObjectURL(blob), title: `Phần ${i + 1}` });
          } catch (e) {
            // Fallback to WAV
            const wavHeader = new ArrayBuffer(44);
            const view = new DataView(wavHeader);
            view.setUint32(0, 0x52494646, false);
            view.setUint32(4, 36 + combinedBytes.length, true);
            view.setUint32(8, 0x57415645, false);
            view.setUint32(12, 0x666d7420, false);
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, 24000, true);
            view.setUint32(28, 24000 * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);
            view.setUint32(36, 0x64617461, false);
            view.setUint32(40, combinedBytes.length, true);
            
            const blob = new Blob([wavHeader, combinedBytes], { type: 'audio/wav' });
            newParts.push({ url: URL.createObjectURL(blob), title: `Phần ${i + 1}` });
          }
        }
        setTtsProgress(Math.round(((i + 1) / textParts.length) * 100));
      }

      setAudioParts(newParts);
      setCurrentPartIndex(0);
      setCurrentTime(0);
      setDuration(0);
    } catch (error: any) {
      console.error("Error generating TTS:", error);
      setError("Có lỗi xảy ra khi tạo giọng nói. Vui lòng thử lại.");
    } finally {
      clearInterval(progressInterval);
      setTtsLoading(false);
      setTimeout(() => setTtsProgress(0), 1000);
    }
  };

  const downloadAudio = (index: number) => {
    const part = audioParts[index];
    if (!part) return;
    const link = document.createElement('a');
    link.href = part.url;
    const fileName = (movieName || review?.title || 'blogradio').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const extension = part.url.includes('audio/wav') || !part.url.includes('mp3') ? 'wav' : 'mp3';
    link.download = `${fileName}_part${index + 1}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const switchPart = (index: number) => {
    setCurrentPartIndex(index);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Playback failed:", e));
      }
    }
  };

  useEffect(() => {
    return () => {
      audioParts.forEach(part => URL.revokeObjectURL(part.url));
    };
  }, [audioParts]);

  useEffect(() => {
    if (audioParts.length > 0 && audioRef.current) {
      audioRef.current.load();
      audioRef.current.play().catch(e => console.error("Auto-play failed:", e));
    }
  }, [currentPartIndex, audioParts]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Background Decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 md:py-24">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
            <Mic2 size={14} />
            AI BLOG RADIO
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
            Blog Radio AI
          </h1>
          <p className="text-zinc-400 text-base max-w-xl mx-auto">
            Lắng nghe những câu chuyện đời thường, những tâm sự sâu lắng qua giọng đọc AI truyền cảm.
          </p>
        </header>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm text-center animate-in fade-in slide-in-from-top-2 duration-300">
            {error}
          </div>
        )}

        {/* Search Section */}
        <div className="space-y-6 mb-16">
          {/* Options & Configuration Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-zinc-900/30 border border-zinc-800/80 rounded-3xl backdrop-blur-xl shadow-xl">
            {/* Thể loại */}
            <div className="space-y-3">
              <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider block">Thể loại kể chuyện</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'hai_huoc', name: 'Hài vui nhộn', icon: <Smile size={16} /> },
                  { id: 'tinh_yeu', name: 'Tình yêu', icon: <Heart size={16} /> },
                  { id: 'cha_me', name: 'Cha mẹ & Con cái', icon: <Users size={16} /> },
                  { id: 'hoc_duong', name: 'Chuyện học đường', icon: <BookOpen size={16} /> },
                  { id: 'tieu_lam', name: 'Tiếu lâm dân gian', icon: <Laugh size={16} /> }
                ].map(genre => (
                  <button
                    key={genre.id}
                    onClick={() => setSelectedGenre(genre.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200 active:scale-95 cursor-pointer",
                      selectedGenre === genre.id
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-md shadow-emerald-500/5"
                        : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
                      genre.id === 'tieu_lam' ? "col-span-2 justify-center" : ""
                    )}
                  >
                    {genre.icon}
                    <span>{genre.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Giọng đọc & Gợi ý chủ đề */}
            <div className="space-y-3 flex flex-col justify-between">
              <div>
                <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider block mb-3">Giọng đọc phát thanh</label>
                <div className="flex gap-2">
                  {[
                    { id: 'nam', name: 'Giọng Nam trầm ấm', desc: 'Trầm ấm, lôi cuốn' },
                    { id: 'nu', name: 'Giọng Nữ nhẹ nhàng', desc: 'Truyền cảm, dịu dàng' }
                  ].map(voice => (
                    <button
                      key={voice.id}
                      onClick={() => setVoiceGender(voice.id)}
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl border text-left transition-all duration-200 active:scale-95 cursor-pointer",
                        voiceGender === voice.id
                          ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-md shadow-emerald-500/5"
                          : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      )}
                    >
                      <span className="block text-sm font-bold">{voice.name}</span>
                      <span className="block text-[10px] opacity-60 mt-0.5">{voice.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Suggest Button */}
              <button
                onClick={generateTopicSuggestion}
                disabled={themeSuggestionLoading}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-blue-500/10 hover:from-emerald-500/20 hover:to-blue-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30 text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {themeSuggestionLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                Tự tạo chủ đề phát thanh
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3 p-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl focus-within:border-emerald-500/50 transition-all shadow-2xl backdrop-blur-xl">
              <div className="pl-4 pt-4 text-zinc-500">
                <Film size={20} />
              </div>
              <textarea 
                placeholder="Mô tả chi tiết về câu chuyện bạn muốn kể (ví dụ: bối cảnh, nhân vật, cốt truyện...)"
                className="flex-1 bg-transparent border-none outline-none py-3 text-base placeholder:text-zinc-600 min-h-[120px] resize-none"
                value={movieName}
                onChange={(e) => setMovieName(e.target.value)}
              />
            </div>

            <textarea 
              placeholder="Nội dung câu chuyện sẽ được hiển thị ở đây sau khi bạn nhấn 'Viết Truyện'..."
              className="w-full min-h-[240px] p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl focus:border-emerald-500/50 transition-all outline-none text-zinc-300 placeholder:text-zinc-600 resize-none backdrop-blur-xl"
              value={movieContent}
              onChange={(e) => setMovieContent(e.target.value)}
            />
          </div>

          {ttsLoading && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <div className="flex justify-between text-[10px] uppercase tracking-widest text-emerald-500 font-bold">
                <span>Đang tạo giọng đọc AI...</span>
                <span>{Math.round(ttsProgress)}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                  style={{ width: `${ttsProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
            <button 
              onClick={clearInputs}
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 border border-zinc-800"
            >
              <Trash2 size={16} />
              Xóa
            </button>
            <button 
              onClick={generateStoryFromDescription}
              disabled={randomLoading}
              className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-sm font-bold rounded-xl transition-all flex items-center gap-2 border border-blue-500/30"
            >
              {randomLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              Viết Truyện
            </button>
            <button 
              onClick={() => generateTTS(movieContent)}
              disabled={ttsLoading || !movieContent.trim()}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2"
            >
              {ttsLoading ? <Loader2 className="animate-spin" size={16} /> : <Mic2 size={16} />}
              Tạo Voice
            </button>
          </div>
        </div>

        {/* Audio Player UI (Global) */}
        {audioParts.length > 0 && (
          <div className="mb-12 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between">
              <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Danh sách phần</h3>
              <button 
                onClick={() => audioParts.forEach((_, i) => downloadAudio(i))}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black text-[10px] font-bold uppercase tracking-wider transition-all border border-emerald-500/20"
              >
                <Download size={12} />
                Tải tất cả
              </button>
            </div>
            {/* Parts List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {audioParts.map((part, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                    currentPartIndex === idx 
                      ? "bg-emerald-500/20 border-emerald-500/40 shadow-lg shadow-emerald-500/10" 
                      : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                  )}
                  onClick={() => switchPart(idx)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                      currentPartIndex === idx ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-400"
                    )}>
                      {idx + 1}
                    </div>
                    <span className={cn(
                      "text-sm font-medium",
                      currentPartIndex === idx ? "text-emerald-400" : "text-zinc-400"
                    )}>
                      {part.title}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAudio(idx);
                    }}
                    className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-emerald-500 hover:text-black transition-all shadow-sm"
                    title="Tải về phần này"
                  >
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Main Player */}
            <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center gap-5 backdrop-blur-xl shadow-2xl shadow-emerald-900/20">
              <button 
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-emerald-500 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/40 shrink-0"
              >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
              </button>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-emerald-400 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Volume2 size={16} />
                    {audioParts[currentPartIndex].title}
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => downloadAudio(currentPartIndex)}
                      className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all border border-emerald-500/30"
                      title="Tải về phần hiện tại"
                    >
                      <Download size={14} />
                    </button>
                    <span className="text-zinc-500 text-[10px] uppercase font-bold">Đang phát phần {currentPartIndex + 1}/3</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400/70 text-xs font-mono w-10">
                    {formatTime(currentTime)}
                  </span>
                  <div className="flex-1 relative group h-6 flex items-center">
                    <input 
                      type="range"
                      min={0}
                      max={duration || 0}
                      step={0.1}
                      value={currentTime}
                      onChange={handleSeek}
                      className="absolute inset-0 w-full h-1.5 bg-zinc-800/50 rounded-full appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all z-10"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(currentTime / (duration || 1)) * 100}%, #27272a 0%)`
                      }}
                    />
                  </div>
                  <span className="text-emerald-400/70 text-xs font-mono w-10 text-right">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>
              
              <audio 
                ref={audioRef} 
                src={audioParts[currentPartIndex].url} 
                onEnded={() => {
                  if (currentPartIndex < audioParts.length - 1) {
                    switchPart(currentPartIndex + 1);
                  } else {
                    setIsPlaying(false);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mt-24 text-center py-20">
            <Loader2 className="mx-auto text-emerald-500 animate-spin mb-4" size={48} />
            <p className="text-zinc-400 animate-pulse">Đang phân tích dữ liệu điện ảnh...</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-zinc-900 text-center text-zinc-600 text-sm">
        <p>© 2026 Blog Radio AI. Powered by Gemini Flash 2.5 & 3.1</p>
      </footer>
    </div>
  );
}
