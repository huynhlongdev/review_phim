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
  Laugh,
  Image,
  Upload,
  X,
  RefreshCw
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import './globals';
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

interface ToneOption {
  id: string;
  name: string;
  desc: string;
  prompt: string;
}

const TONES: ToneOption[] = [
  {
    id: 'ban_hang',
    name: 'Bán hàng',
    desc: 'Thuyết phục, lôi cuốn, quảng cáo chuyên nghiệp',
    prompt: 'thuyết phục, lôi cuốn, chuyên nghiệp, tràn đầy động lực quảng cáo giới thiệu sản phẩm và bán lẻ'
  },
  {
    id: 'vlog',
    name: 'Vlog',
    desc: 'Trải nghiệm thực tế, chia sẻ gần gũi',
    prompt: 'tự nhiên, chân thật, chia sẻ trải nghiệm thực tế, gần gũi như một người bạn đang trò chuyện vlog hàng ngày'
  }
];

export default function App() {
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

  // Image states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageMimeType, setImageMimeType] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  // Core state variables
  const [selectedTone, setSelectedTone] = useState('ban_hang'); // 'ban_hang' as default tone
  const [themeSuggestionLoading, setThemeSuggestionLoading] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.2);

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
      audioRef.current.playbackRate = playbackSpeed;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const fileToBase64 = (file: File): Promise<{ base64: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve({ base64: base64Data, mimeType: file.type });
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleImageChange(files[0]);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl('');
    setImageBase64('');
    setImageMimeType('');
  };

  const handleImageChange = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError("Vui lòng chỉ tải lên tệp tin hình ảnh.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Dung lượng ảnh tối đa là 5MB.");
      return;
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setError(null);

    try {
      const res = await fileToBase64(file);
      setImageBase64(res.base64);
      setImageMimeType(res.mimeType);
      
      // Auto-trigger generation with selected tone immediately
      await generateSalesContent(res.base64, res.mimeType, selectedTone);
    } catch (err: any) {
      console.error("Error analyzing image:", err);
      setError("Không thể tự động phân tích hình ảnh này. Vui lòng thử lại.");
    }
  };

  const clearInputs = () => {
    setMovieContent('');
    setReview(null);
    removeImage();
    if (audioParts.length > 0) {
      audioParts.forEach(part => URL.revokeObjectURL(part.url));
      setAudioParts([]);
    }
  };

  const generateSalesContent = async (
    overrideImageBase64?: string,
    overrideImageMimeType?: string,
    overrideTone?: string
  ) => {
    const base64 = overrideImageBase64 !== undefined ? overrideImageBase64 : imageBase64;
    const mime = overrideImageMimeType !== undefined ? overrideImageMimeType : imageMimeType;
    const toneId = overrideTone !== undefined ? overrideTone : selectedTone;

    if (!base64) {
      setError("Vui lòng tải ảnh sản phẩm lên để hệ thống tự động tạo nội dung kịch bản.");
      return;
    }
    setRandomLoading(true);
    setError(null);
    
    try {
      const activeTone = TONES.find(t => t.id === toneId) || TONES[0];
      const isVlog = activeTone.id === 'vlog';
      
      let prompt = '';
      if (isVlog) {
        prompt = `Bạn là một Vlogger chuyên nghiệp và sành điệu, có lối trò chuyện, review chân thật, cuốn hút và vô cùng gần gũi với khán giả Việt Nam. 
Hãy phân tích kỹ hình ảnh sản phẩm được đính kèm này. 
Dựa trên sản phẩm trong ảnh, hãy viết một kịch bản chia sẻ Vlog trải nghiệm thực tế ngắn bằng tiếng Việt cực kỳ thu hút, lôi cuốn người nghe ngay từ những câu chữ đầu tiên.

## YÊU CẦU ĐẶC BIỆT VỀ ĐỘ DÀI & ĐỊNH DẠNG (BẮT BUỘC):
- **Thời lượng**: Nội dung phải được viết để đọc trong tối đa 1 phút (khoảng **110 đến 130 từ**). Tuyệt đối không viết dài hơn 140 từ để đảm bảo nhịp điệu đọc tự nhiên và giữ chân người nghe tốt nhất.
- **Sắc thái kịch bản**: Viết theo tông giọng chia sẻ Vlog ${activeTone.prompt}.
- **Cấu trúc**: Viết thành một kịch bản liền mạch trôi chảy từ đầu đến cuối, không có tiêu đề phụ, không có đề mục, không dùng ký tự đặc biệt hay emoji phức tạp khó đọc, không chèn thẻ hội thoại hay tên nhân vật dẫn chuyện. Chỉ viết thuần văn xuôi dễ đọc bằng tiếng Việt để công cụ đọc giọng nói đọc trực tiếp trôi chảy từ đầu đến cuối.

Hãy tập trung vào trải nghiệm thực tế với sản phẩm trong ảnh, tạo cảm xúc gần gũi, chân thành nhất để người nghe thích thú tò mò.`;
      } else {
        prompt = `Bạn là một chuyên gia viết kịch bản quảng cáo và copywriter bán hàng đỉnh cao, có khả năng viết những lời chào mời cực kỳ lôi cuốn, thuyết phục và giàu cảm xúc. 
Hãy phân tích kỹ hình ảnh sản phẩm được đính kèm này. 
Dựa trên sản phẩm trong ảnh, hãy viết một kịch bản bán hàng bằng tiếng Việt cực kỳ thu hút, nhắm trúng tâm lý khách hàng Việt Nam.

## YÊU CẦU ĐẶC BIỆT VỀ ĐỘ DÀI & ĐỊNH DẠNG (BẮT BUỘC):
- **Thời lượng**: Nội dung phải được viết để đọc trong tối đa 1 phút (khoảng **110 đến 130 từ**). Không viết dài hơn 140 từ để người nghe không bị mỏi tai.
- **Sắc thái kịch bản**: Viết theo tông giọng kịch bản bán hàng ${activeTone.prompt}.
- **Cấu trúc**: Viết thành một kịch bản liền mạch trôi chảy, không có tiêu đề phụ, không có đề mục, không sử dụng ký tự đặc biệt hay emoji phức tạp khó đọc, không chèn thẻ hội thoại hay tên nhân vật dẫn chuyện. Chỉ viết thuần văn xuôi dễ đọc bằng tiếng Việt để công cụ đọc giọng nói đọc trực tiếp trôi chảy từ đầu đến cuối.

Hãy tập trung vào lợi ích lớn nhất và tính năng vượt trội của sản phẩm trong ảnh, kêu gọi hành động (CTA) thật tự nhiên nhưng mạnh mẽ và khẩn thiết ở cuối.`;
      }

      // Add uniqueness suffix
      prompt += `\n\nLưu ý quan trọng: Hãy sáng tạo một kịch bản hoàn toàn mới mẻ, mang góc nhìn và từ ngữ khác biệt với các lần tạo trước đó nếu có để người dùng có nhiều phương án lựa chọn.`;

      const contents = [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mime,
                data: base64
              }
            }
          ]
        }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
      });

      const story = response.text || '';
      setMovieContent(story);
      setReview(null);
    } catch (error: any) {
      console.error("Error generating sales content:", error);
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        setError("Hệ thống đang quá tải (hết lượt dùng thử). Vui lòng thử lại sau vài phút.");
      } else {
        setError("Có lỗi xảy ra khi tạo kịch bản. Vui lòng thử lại.");
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

    // For 1-minute sales pitch, we read the entire text in a single continuous segment
    const textParts = [text.trim()];

    const progressInterval = setInterval(() => {
      setTtsProgress(prev => {
        if (prev >= 75) return prev;
        return prev + 1;
      });
    }, 500);

    try {
      const selectedPrebuiltVoice = 'Puck'; // Adam voice is Puck
      const activeTone = TONES.find(t => t.id === selectedTone) || TONES[0];
      const allPartsPCMBytes: Uint8Array[] = [];

      for (let i = 0; i < textParts.length; i++) {
        const partText = textParts[i];
        // Ensure synchronized tone, pace and voice characteristics with rich emotional sales copy intonation
        const prompt = `Bạn là một người đọc quảng cáo và lồng tiếng bán hàng chuyên nghiệp, sở hữu chất giọng Nam trầm ấm, cực kỳ truyền cảm, lôi cuốn và đầy sức thuyết phục. Hãy đọc đoạn kịch bản bán hàng dưới đây bằng tiếng Việt với sắc thái giọng đọc diễn cảm ${activeTone.prompt}. Hãy thể hiện thật tự nhiên, lôi cuốn người nghe, nhấn nhá rõ ràng vào các từ khóa then chốt của sản phẩm, giữ tốc độ đọc vừa phải, mạch lạc, tuyệt đối không bị tạp âm hay vang vọng: ${partText}`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedPrebuiltVoice },
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
          allPartsPCMBytes.push(combinedBytes);
        }
        setTtsProgress(Math.round(((i + 1) / textParts.length) * 80));
      }

      const newParts: { url: string, title: string }[] = [];

      if (allPartsPCMBytes.length > 0) {
        setTtsProgress(85);
        let totalMergedLength = 0;
        for (const bytes of allPartsPCMBytes) {
          totalMergedLength += bytes.length;
        }
        const mergedBytes = new Uint8Array(totalMergedLength);
        let mergeOffset = 0;
        for (const bytes of allPartsPCMBytes) {
          mergedBytes.set(bytes, mergeOffset);
          mergeOffset += bytes.length;
        }

        setTtsProgress(90);

        // Convert merged PCM bytes to MP3
        try {
          const pcmLength = Math.floor(mergedBytes.length / 2);
          const int16Samples = new Int16Array(mergedBytes.buffer, mergedBytes.byteOffset, pcmLength);
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
          newParts.push({ url: URL.createObjectURL(blob), title: "Toàn bộ câu chuyện" });
        } catch (e) {
          console.error("MP3 compression failed, fallback to WAV", e);
          // Fallback to WAV
          const wavHeader = new ArrayBuffer(44);
          const view = new DataView(wavHeader);
          view.setUint32(0, 0x52494646, false);
          view.setUint32(4, 36 + mergedBytes.length, true);
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
          view.setUint32(40, mergedBytes.length, true);
          
          const blob = new Blob([wavHeader, mergedBytes], { type: 'audio/wav' });
          newParts.push({ url: URL.createObjectURL(blob), title: "Toàn bộ câu chuyện" });
        }
      }

      setTtsProgress(100);
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
    const fileName = 'audio_kich_ban';
    const extension = part.url.includes('audio/wav') || !part.url.includes('mp3') ? 'wav' : 'mp3';
    link.download = `${fileName}.${extension}`;
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
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().catch(e => console.error("Auto-play failed:", e));
    }
  }, [currentPartIndex, audioParts]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Background Decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12 md:py-24">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
            <Mic2 size={14} />
            AI SALES COPYWRITER & VOICE ACTOR
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
            Quảng Cáo & Bán Hàng AI
          </h1>
          <p className="text-zinc-400 text-base max-w-xl mx-auto">
            Đăng tải hình ảnh sản phẩm để tự động phân tích kịch bản và phát thanh giọng đọc Adam trầm ấm, cuốn hút tối đa 1 phút.
          </p>
        </header>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm text-center animate-in fade-in slide-in-from-top-2 duration-300">
            {error}
          </div>
        )}

        {/* Main Content Container */}
        <div className="max-w-4xl mx-auto space-y-6">

        {/* Search Section */}
        <div className="space-y-6 mb-16">
          
          {/* Image Upload Area (TOPMOST) */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "p-8 border-2 border-dashed rounded-3xl backdrop-blur-xl transition-all duration-300 text-center flex flex-col items-center justify-center gap-4 relative overflow-hidden group min-h-[220px]",
              isDragging 
                ? "border-emerald-500 bg-emerald-500/5 shadow-2xl shadow-emerald-500/5 scale-[1.01]" 
                : imagePreviewUrl
                  ? "border-zinc-800/80 bg-zinc-900/10"
                  : "border-zinc-800/80 bg-zinc-900/20 hover:border-zinc-700/80 hover:bg-zinc-900/30"
            )}
          >
            {imagePreviewUrl ? (
              <div className="relative w-full max-w-sm mx-auto">
                <img 
                  src={imagePreviewUrl} 
                  alt="Sản phẩm" 
                  className="rounded-2xl max-h-[180px] w-auto mx-auto object-contain shadow-2xl border border-zinc-800"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage();
                  }}
                  className="absolute top-2 right-2 p-2 bg-black/80 hover:bg-red-600 hover:text-white text-zinc-400 rounded-full transition-all cursor-pointer shadow-lg"
                  title="Xóa ảnh"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-zinc-950/80 flex items-center justify-center border border-zinc-800 text-zinc-500 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all shadow-inner">
                  <Upload size={24} className="group-hover:scale-110 transition-all duration-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Kéo & thả ảnh sản phẩm tại đây</p>
                  <p className="text-xs text-zinc-500 mt-1">hoặc nhấn để chọn tệp từ thiết bị của bạn</p>
                </div>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageChange(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </>
            )}
          </div>

          {/* Options & Configuration Dashboard */}
          <div className="p-6 bg-zinc-900/30 border border-zinc-800/80 rounded-3xl backdrop-blur-xl shadow-xl space-y-6">
            {/* Sắc thái giọng đọc Adam */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-zinc-300 text-xs font-bold uppercase tracking-wider">Sắc thái giọng đọc (Adam)</label>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Lựa chọn tông giọng thuyết minh quảng cáo hoặc vlog phù hợp</p>
                </div>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold uppercase">Nam trầm ấm</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {TONES.map((tone) => (
                  <button
                    key={tone.id}
                    onClick={async () => {
                      setSelectedTone(tone.id);
                      if (imageBase64) {
                        await generateSalesContent(imageBase64, imageMimeType, tone.id);
                      }
                    }}
                    className={cn(
                      "px-4 py-4 rounded-2xl border text-left transition-all duration-200 active:scale-95 cursor-pointer flex flex-col justify-center",
                      selectedTone === tone.id
                        ? "bg-emerald-500/15 border-emerald-500/60 text-emerald-400 shadow-md shadow-emerald-500/10"
                        : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    )}
                  >
                    <span className="block text-sm font-bold">{tone.name}</span>
                    <span className="block text-[11px] opacity-65 mt-1 leading-tight">{tone.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <textarea 
              placeholder="Nội dung kịch bản (độ dài tối đa 1 phút đọc) sẽ tự động xuất hiện tại đây sau khi bạn tải ảnh lên..."
              className="w-full min-h-[220px] p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl focus:border-emerald-500/50 transition-all outline-none text-zinc-300 placeholder:text-zinc-600 resize-none backdrop-blur-xl"
              value={movieContent}
              onChange={(e) => setMovieContent(e.target.value)}
            />
          </div>

          {ttsLoading && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <div className="flex justify-between text-[10px] uppercase tracking-widest text-emerald-500 font-bold">
                <span>Đang tạo giọng đọc quảng cáo AI...</span>
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
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 border border-zinc-800 cursor-pointer"
            >
              <Trash2 size={16} />
              Xóa tất cả
            </button>
            <button 
              onClick={() => generateSalesContent(imageBase64, imageMimeType, selectedTone)}
              disabled={randomLoading || !imageBase64}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              {randomLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Tạo content khác
            </button>
            <button 
              onClick={() => generateTTS(movieContent)}
              disabled={ttsLoading || !movieContent.trim()}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              {ttsLoading ? <Loader2 className="animate-spin" size={16} /> : <Mic2 size={16} />}
              Đọc Kịch Bản (Voice Adam)
            </button>
          </div>
        </div>

        {/* Audio Player UI (Global) */}
        {audioParts.length > 0 && (
          <div className="mb-12 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            {audioParts.length > 1 && (
              <>
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
              </>
            )}

            {/* Main Player */}
            <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center gap-5 backdrop-blur-xl shadow-2xl shadow-emerald-900/20">
              <button 
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-emerald-500 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/40 shrink-0 cursor-pointer"
              >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
              </button>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-emerald-400 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Volume2 size={16} />
                    {audioParts[currentPartIndex].title}
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Speed Controls */}
                    <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase px-1.5 hidden sm:inline">Tốc độ:</span>
                      {[1.0, 1.2, 1.5, 1.8].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => setPlaybackSpeed(speed)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer",
                            playbackSpeed === speed 
                              ? "bg-emerald-500 text-black shadow-sm" 
                              : "text-zinc-400 hover:text-white"
                          )}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={() => downloadAudio(currentPartIndex)}
                      className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all border border-emerald-500/30 cursor-pointer"
                      title="Tải về giọng đọc"
                    >
                      <Download size={14} />
                    </button>
                    {audioParts.length > 1 && (
                      <span className="text-zinc-500 text-[10px] uppercase font-bold">Đang phát phần {currentPartIndex + 1}/{audioParts.length}</span>
                    )}
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
                onPlay={() => {
                  setIsPlaying(true);
                  if (audioRef.current) {
                    audioRef.current.playbackRate = playbackSpeed;
                  }
                }}
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
        </div> {/* End of max-w-4xl container */}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-zinc-900 text-center text-zinc-600 text-sm">
        <p>© 2026 Blog Radio AI. Powered by Gemini Flash 2.5 & 3.1</p>
      </footer>
    </div>
  );
}
