"use client";

import React from "react";
import { motion } from "framer-motion";
import { Mic } from "lucide-react";

export type AssistantState = "idle" | "listening" | "processing" | "speaking";

export default function VoiceWave({ state = "idle" }: { state?: AssistantState }) {
  const orbVariants = {
    idle: { scale: 1, boxShadow: "0px 0px 20px rgba(20, 184, 166, 0.2)" },
    listening: { scale: 1.1, boxShadow: "0px 0px 50px rgba(20, 184, 166, 0.5)" },
    processing: { scale: 1.05, boxShadow: "0px 0px 30px rgba(14, 165, 233, 0.4)" },
    speaking: { scale: 1.15, boxShadow: "0px 0px 60px rgba(14, 165, 233, 0.6)" },
  };

  const generateBars = (count: number) => {
    return Array.from({ length: count }).map((_, i) => {
      const heightIdle = 10 + Math.random() * 10;
      const heightListening = 20 + Math.random() * 50;
      const heightSpeaking = 30 + Math.random() * 70;

      return (
        <motion.div
          key={i}
          className="w-1.5 rounded-full mx-0.5"
          animate={{
            height:
              state === "listening"
                ? [heightListening * 0.5, heightListening, heightListening * 0.5]
                : state === "speaking"
                ? [heightSpeaking * 0.5, heightSpeaking, heightSpeaking * 0.5]
                : state === "processing"
                ? [15, 20, 15]
                : heightIdle,
            backgroundColor:
              state === "processing" || state === "speaking"
                ? "rgba(14, 165, 233, 0.7)" 
                : "rgba(20, 184, 166, 0.7)",
          }}
          transition={{
            repeat: Infinity,
            duration: state === "processing" ? 1.5 : 0.8 + Math.random() * 0.5,
            ease: "easeInOut",
          }}
        />
      );
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full relative overflow-hidden bg-white rounded-xl">
      <motion.div
        className="absolute w-64 h-64 rounded-full blur-[80px] -z-10"
        animate={{
          backgroundColor:
            state === "listening" ? "rgba(20, 184, 166, 0.15)" :
            state === "speaking" ? "rgba(14, 165, 233, 0.15)" :
            "rgba(248, 250, 252, 1)",
        }}
        transition={{ duration: 1 }}
      />
      <motion.div
        variants={orbVariants}
        animate={state}
        transition={{ duration: 0.5, ease: "easeInOut", repeat: state === "idle" ? Infinity : 0, repeatType: "reverse" }}
        className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center relative z-10 border border-teal-100"
      >
        <Mic className={state === "processing" ? "text-sky-500" : "text-teal-500"} size={28} />
      </motion.div>
      <div className="flex items-end h-24 mt-6">
        {generateBars(35)}
      </div>
      <div className="mt-4 text-slate-500 uppercase tracking-widest text-xs font-semibold">
        {state === "idle" && "Ready"}
        {state === "listening" && "Listening..."}
        {state === "processing" && "Analyzing..."}
        {state === "speaking" && "Responding"}
      </div>
    </div>
  );
}
