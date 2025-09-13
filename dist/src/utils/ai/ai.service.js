"use strict";
// import OpenAI from "openai";
Object.defineProperty(exports, "__esModule", { value: true });
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// export async function summarizeLogs(logs: string[]): Promise<string> {
//   try {
//     const response = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: "You are a helpful assistant that summarizes logs.",
//         },
//         {
//           role: "user",
//           content: `Please summarize the following logs:\n${logs.join("\n")}`,
//         },
//       ],
//       max_tokens: 150,
//     });
//     return response.choices[0].message.content;
//   } catch (error) {
//     console.error("Error summarizing logs:", error);
//     throw new Error("Failed to summarize logs");
//   }
// }
// export async function analyzeLogs(logs: string[]): Promise<string> {
//   try {
//     const response = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: "You are a helpful assistant that analyzes logs.",
//         },
//         {
//           role: "user",
//           content: `Please analyze the following logs:\n${logs.join("\n")}`,
//         },
//       ],
//       max_tokens: 150,
//     });
//     return response.choices[0].message.content;
//   } catch (error) {
//     console.error("Error analyzing logs:", error);
//     throw new Error("Failed to analyze logs");
//   }
// }
// export async function generateInsights(logs: string[]): Promise<string> {
//   try {
//     const response = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: "You are a helpful assistant that generates insights from logs.",
//         },
//         {
//           role: "user",
//           content: `Please generate insights from the following logs:\n${logs.join("\n")}`,
//         },
//       ],
//       max_tokens: 150,
//     });
//     return response.choices[0].message.content;
//   } catch (error) {
//     console.error("Error generating insights:", error);
//     throw new Error("Failed to generate insights");
//   }
// }
// export async function classifyLogs(logs: string[]): Promise<string[]> {
//   try {
//     const response = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: "You are a helpful assistant that classifies logs.",
//         },
//         {
//           role: "user",
//           content: `Please classify the following logs:\n${logs.join("\n")}`,
//         },
//       ],
//       max_tokens: 150,
//     });
//     return response.choices[0].message.content.split("\n").map((line) => line.trim());
//   } catch (error) {
//     console.error("Error classifying logs:", error);
//     throw new Error("Failed to classify logs");
//   }
// }
// export async function detectAnomalies(logs: string[]): Promise<string[]> {  
//   try {
//     const response = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: "You are a helpful assistant that detects anomalies in logs.",
//         },
//         {
//           role: "user",
//           content: `Please detect anomalies in the following logs:\n${logs.join("\n")}`,
//         },
//       ],
//       max_tokens: 150,
//     });
//     return response.choices[0].message.content.split("\n").map((line) => line.trim());
//   } catch (error) {
//     console.error("Error detecting anomalies:", error);
//     throw new Error("Failed to detect anomalies");
//   }
// }
// export async function generateReport(logs: string[]): Promise<string> {
//   try {
//     const response = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: "You are a helpful assistant that generates reports from logs.",
//         },
//         {
//           role: "user",
//           content: `Please generate a report from the following logs:\n${logs.join("\n")}`,
//         },
//       ],
//       max_tokens: 300,
//     });
//     return response.choices[0].message.content;
//   } catch (error) {
//     console.error("Error generating report:", error);
//     throw new Error("Failed to generate report");
//   }
// }
// export async function generateSummary(logs: string[]): Promise<string> {
//   try {
//     const response = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: "You are a helpful assistant that summarizes logs.",
//         },
//         {
//           role: "user",
//           content: `Please summarize the following logs:\n${logs.join("\n")}`,
//         },
//       ],
//       max_tokens: 150,
//     });
//     return response.choices[0].message.content;
//   } catch (error) {
//     console.error("Error generating summary:", error);
//     throw new Error("Failed to generate summary");
//   }
// }
// export async function generateInsightsFromLogs(logs: string[]): Promise<string> {
//   try {
//     const response = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: "You are a helpful assistant that generates insights from logs.",
//         },
//         {
//           role: "user",
//           content: `Please generate insights from the following logs:\n${logs.join("\n")}`,
//         },
//       ],
//       max_tokens: 150,
//     });
//     return response.choices[0].message.content;
//   } catch (error) {
//     console.error("Error generating insights from logs:", error);
//     throw new Error("Failed to generate insights from logs");
//   }
// }
// export async function generateClassification(logs: string[]): Promise<string[]> {
//   try {
//     const response = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: "You are a helpful assistant that classifies logs.",
//         },
//         {
//           role: "user",
//           content: `Please classify the following logs:\n${logs.join("\n")}`,
//         },
//       ],
//       max_tokens: 150,
//     });
//     return response.choices[0].message.content.split("\n").map((line) => line.trim());
//   } catch (error) {
//     console.error("Error generating classification:", error);
//     throw new Error("Failed to generate classification");
//   }
// }
