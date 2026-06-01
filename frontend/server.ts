import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Define data types directly or import from types
import { CloudAccount, CloudFile, ActivityLog, DuplicateGroup, IntelligenceAlert } from "./src/types.js";

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini API Client initialized successfully.");
  } else {
    console.log("No valid GEMINI_API_KEY found. AI features will fallback to smart mock simulation.");
  }
} catch (error) {
  console.error("Failed to initialize Gemini client:", error);
}

// IN-MEMORY DATABASE
let accounts: CloudAccount[] = [
  {
    id: "acc-1",
    email: "work@company.com",
    provider: "Google Drive",
    quotaBytes: 2 * 1024 * 1024 * 1024 * 1024, // 2 TB
    usedBytes: 1.1 * 1024 * 1024 * 1024 * 1024, // 1.1 TB
    status: "synced",
    syncFrequency: "15m",
    color: "#4285f4",
  },
  {
    id: "acc-2",
    email: "personal@gmail.com",
    provider: "Google Drive",
    quotaBytes: 15 * 1024 * 1024 * 1024, // 15 GB
    usedBytes: 13.8 * 1024 * 1024 * 1024, // 13.8 GB
    status: "synced",
    syncFrequency: "hourly",
    color: "#ea4335",
  },
  {
    id: "acc-3",
    email: "archive.store@gmail.com",
    provider: "Google Drive",
    quotaBytes: 1 * 1024 * 1024 * 1024 * 1024, // 1 TB
    usedBytes: 350 * 1024 * 1024 * 1024, // 350 GB
    status: "synced",
    syncFrequency: "hourly",
    color: "#34a853",
  },
  {
    id: "acc-4",
    email: "work.ops@company.com",
    provider: "Google Drive",
    quotaBytes: 500 * 1024 * 1024 * 1024, // 500 GB
    usedBytes: 170 * 1024 * 1024 * 1024, // 170 GB
    status: "syncing",
    syncFrequency: "realtime",
    color: "#fbbc04",
  },
  {
    id: "acc-5",
    email: "archive.media@domain.net",
    provider: "OneDrive",
    quotaBytes: 1 * 1024 * 1024 * 1024 * 1024, // 1 TB
    usedBytes: 450 * 1024 * 1024 * 1024, // 450 GB
    status: "auth_error",
    syncFrequency: "manual",
    color: "#ab47bc",
  }
];

let files: CloudFile[] = [
  // Regular files
  {
    id: "file-1",
    name: "Q3_Financial_Report_Final.pdf",
    path: "/Q3 Planning/Design Assets/Q3_Financial_Report_Final.pdf",
    sizeBytes: 2.4 * 1024 * 1024, // 2.4 MB
    category: "docs",
    starred: false,
    modified: "Yesterday",
    accountEmail: "personal@gmail.com",
  },
  {
    id: "file-2",
    name: "User_Analytics_Export.csv",
    path: "/Q3 Planning/Design Assets/User_Analytics_Export.csv",
    sizeBytes: 856 * 1024, // 856 KB
    category: "data",
    starred: true,
    modified: "Oct 20, 2024",
    accountEmail: "personal@gmail.com",
  },
  {
    id: "file-3",
    name: "Hero_Concept_v3.png",
    path: "/Q3 Planning/Design Assets/Hero_Concept_v3.png",
    sizeBytes: 4.1 * 1024 * 1024, // 4.1 MB
    category: "images",
    starred: false,
    modified: "Oct 18, 2024",
    accountEmail: "archive.store@gmail.com",
  },
  {
    id: "file-4",
    name: "Meeting_Notes_All_Hands.docx",
    path: "/Q3 Planning/Design Assets/Meeting_Notes_All_Hands.docx",
    sizeBytes: 124 * 1024, // 124 KB
    category: "docs",
    starred: false,
    modified: "Oct 15, 2024",
    accountEmail: "work@company.com",
  },
  {
    id: "dir-1",
    name: "Brand Guidelines 2024",
    path: "/Q3 Planning/Design Assets/Brand Guidelines 2024",
    sizeBytes: 0, // Folder
    category: "other",
    starred: false,
    modified: "Oct 24, 2024",
    accountEmail: "work@company.com",
  },

  // Stale files (>1 year)
  {
    id: "file-stale-1",
    name: "2021_Tax_Returns_Backup.zip",
    path: "/Archive/2021_Tax_Returns_Backup.zip",
    sizeBytes: 1.4 * 1024 * 1024 * 1024, // 1.4 GB
    category: "archive",
    starred: false,
    modified: "Oct 14, 2021",
    accountEmail: "archive.store@gmail.com",
  },
  {
    id: "file-stale-2",
    name: "Draft_Proposal_v1.docx",
    path: "/Drafts/Draft_Proposal_v1.docx",
    sizeBytes: 15 * 1024 * 1024, // 15 MB
    category: "docs",
    starred: false,
    modified: "Jan 03, 2022",
    accountEmail: "personal@gmail.com",
  },

  // Huge files
  {
    id: "file-huge-1",
    name: "Company_AllHands_Rec.mp4",
    path: "/Videos/Company_AllHands_Rec.mp4",
    sizeBytes: 3.4 * 1024 * 1024 * 1024, // 3.4 GB
    category: "video",
    starred: false,
    modified: "Dec 12, 2025",
    accountEmail: "work@company.com",
  },
  {
    id: "file-huge-2",
    name: "DB_Dump_Prod_01.sql",
    path: "/Database/DB_Dump_Prod_01.sql",
    sizeBytes: 1.8 * 1024 * 1024 * 1024, // 1.8 GB
    category: "data",
    starred: false,
    modified: "Feb 22, 2026",
    accountEmail: "archive.store@gmail.com",
  },

  // Duplicate files (Group 1: Q4_Marketing_Promo_Final.mp4, wasted: 1.2 GB, individual: 600 MB)
  {
    id: "dup-1a",
    name: "Q4_Marketing_Promo_Final.mp4",
    path: "/Drive/Marketing/Q4_Promo.mp4",
    sizeBytes: 600 * 1024 * 1024, // 600 MB
    category: "video",
    starred: false,
    modified: "Yesterday",
    accountEmail: "work@company.com",
  },
  {
    id: "dup-1b",
    name: "Q4_Marketing_Promo_Final.mp4",
    path: "/Dropbox/Shared/Video/Q4_Promo.mp4",
    sizeBytes: 600 * 1024 * 1024, // 600 MB
    category: "video",
    starred: false,
    modified: "Yesterday",
    accountEmail: "personal@gmail.com",
  },
  {
    id: "dup-1c",
    name: "Q4_Marketing_Promo_Final.mp4",
    path: "/OneDrive/Archive/2023/Promo.mp4",
    sizeBytes: 600 * 1024 * 1024, // 600 MB
    category: "video",
    starred: false,
    modified: "Yesterday",
    accountEmail: "archive.store@gmail.com",
  },

  // Duplicate files (Group 2: Design_Assets_V2.zip, wasted: 850 MB, individual: 850 MB)
  {
    id: "dup-2a",
    name: "Design_Assets_V2.zip",
    path: "/Drive/Design/Assets_V2.zip",
    sizeBytes: 850 * 1024 * 1024, // 850 MB
    category: "archive",
    starred: false,
    modified: "Oct 12, 2025",
    accountEmail: "work@company.com",
  },
  {
    id: "dup-2b",
    name: "Design_Assets_V2.zip",
    path: "/Drive/Downloads/Design_Assets_V2.zip",
    sizeBytes: 850 * 1024 * 1024, // 850 MB
    category: "archive",
    starred: false,
    modified: "Oct 12, 2025",
    accountEmail: "work@company.com",
  }
];

let activityLogs: ActivityLog[] = [
  {
    id: "act-1",
    message: "Q3_Financial_Report_v2.pdf synthesized",
    timestamp: "2m ago",
    iconType: "sync",
    sizeBytes: 2.4 * 1024 * 1024,
    accountEmail: "work@company.com",
  },
  {
    id: "act-2",
    message: "Uploaded Design_Assets_2024.zip",
    timestamp: "15m ago",
    iconType: "upload",
    sizeBytes: 850 * 1024 * 1024,
    accountEmail: "personal@gmail.com",
  },
  {
    id: "act-3",
    message: "Moved \"Old Projects\" to Archive",
    timestamp: "1h ago",
    iconType: "move",
    sizeBytes: 12 * 1024 * 1024 * 1024,
    accountEmail: "archive.store@gmail.com",
  }
];

// Helper to calculate total duplicate groups
function getDuplicateGroups(): DuplicateGroup[] {
  // Group duplicate files by file name and size
  const groups: { [key: string]: CloudFile[] } = {};
  files.forEach((file) => {
    // Only group file names that have duplication and are actual files
    if (file.sizeBytes > 0) {
      const key = `${file.name.toLowerCase()}_${file.sizeBytes}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(file);
    }
  });

  const dupGroups: DuplicateGroup[] = [];
  Object.keys(groups).forEach((key) => {
    const groupFiles = groups[key];
    if (groupFiles.length > 1) {
      const filename = groupFiles[0].name;
      const sizeBytes = groupFiles[0].sizeBytes;
      const totalCount = groupFiles.length;
      dupGroups.push({
        id: `group-${filename.replace(/\s+/g, "-")}`,
        filename: filename,
        totalSizeBytes: sizeBytes,
        wastedSizeBytes: (totalCount - 1) * sizeBytes,
        instances: groupFiles.map((file) => ({
          fileId: file.id,
          path: file.path,
          sizeBytes: file.sizeBytes,
          accountEmail: file.accountEmail,
        })),
      });
    }
  });

  return dupGroups.sort((a, b) => b.wastedSizeBytes - a.wastedSizeBytes);
}

// API ENDPOINTS

// 1. GET Accounts
app.get("/api/accounts", (req, res) => {
  res.json(accounts);
});

// 2. CONNECT Account
app.post("/api/accounts", (req, res) => {
  const { email, provider, quotaGB, syncFrequency } = req.body;
  if (!email || !provider || !quotaGB) {
    return res.status(400).json({ error: "Missing required account fields." });
  }

  // Pre-determined branding colors for providers
  let color = "#4285f4"; // Google Blue
  if (provider === "OneDrive") color = "#0078d4";
  else if (provider === "Dropbox") color = "#0061ff";
  else if (provider === "AWS S3") color = "#ff9900";
  else if (provider === "Box") color = "#1a1c1c";

  const newAccount: CloudAccount = {
    id: `acc-${Date.now()}`,
    email,
    provider,
    quotaBytes: parseInt(quotaGB) * 1024 * 1024 * 1024,
    usedBytes: 0,
    status: "synced",
    syncFrequency: syncFrequency || "15m",
    color,
  };

  accounts.push(newAccount);

  // Log activity
  activityLogs.unshift({
    id: `act-${Date.now()}`,
    message: `Connected new ${provider} account: ${email}`,
    timestamp: "Just now",
    iconType: "sync",
    accountEmail: email,
  });

  res.status(201).json(newAccount);
});

// 3. EDIT Account (Disconnect, change Frequency 또는 Reauthorize)
app.post("/api/accounts/:id/action", (req, res) => {
  const { id } = req.params;
  const { action, syncFrequency } = req.body; // 'disconnect', 'reauthorize', 'frequency'

  const index = accounts.findIndex((a) => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Account not found" });
  }

  const account = accounts[index];

  if (action === "disconnect") {
    accounts = accounts.filter((a) => a.id !== id);
    // Also remove associated files
    files = files.filter((f) => f.accountEmail !== account.email);

    activityLogs.unshift({
      id: `act-${Date.now()}`,
      message: `Disconnected account: ${account.email}`,
      timestamp: "Just now",
      iconType: "warning",
      accountEmail: account.email,
    });

    return res.json({ success: true, message: "Account disconnected" });
  }

  if (action === "reauthorize") {
    account.status = "synced";
    // Increase fake space usage or refresh
    activityLogs.unshift({
      id: `act-${Date.now()}`,
      message: `Re-authorized connection for ${account.email}`,
      timestamp: "Just now",
      iconType: "sync",
      accountEmail: account.email,
    });
    return res.json(account);
  }

  if (action === "frequency" && syncFrequency) {
    account.syncFrequency = syncFrequency;
    return res.json(account);
  }

  res.status(400).json({ error: "Invalid action" });
});

// 4. GET Files (supports filters)
app.get("/api/files", (req, res) => {
  const { category, starred } = req.query;
  let filtered = [...files];

  if (category && category !== "All") {
    filtered = filtered.filter((f) => f.category === category);
  }
  if (starred === "true") {
    filtered = filtered.filter((f) => f.starred);
  }

  res.json(filtered);
});

// 5. STAR File toggle
app.post("/api/files/:id/star", (req, res) => {
  const { id } = req.params;
  const file = files.find((f) => f.id === id);
  if (!file) {
    return res.status(404).json({ error: "File not found" });
  }
  file.starred = !file.starred;
  res.json(file);
});

// 6. DELETE / Remove a specific file (moves/deletes)
app.delete("/api/files/:id", (req, res) => {
  const { id } = req.params;
  const index = files.findIndex((f) => f.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "File not found" });
  }

  const file = files[index];
  files = files.filter((f) => f.id !== id);

  // Re-calculate the account associated size
  const account = accounts.find((a) => a.email === file.accountEmail);
  if (account) {
    account.usedBytes = Math.max(0, account.usedBytes - file.sizeBytes);
  }

  activityLogs.unshift({
    id: `act-${Date.now()}`,
    message: `Deleted file "${file.name}"`,
    timestamp: "Just now",
    iconType: "delete",
    sizeBytes: file.sizeBytes,
    accountEmail: file.accountEmail,
  });

  res.json({ success: true, fileId: id });
});

// 7. UPLOAD file - smart routes
app.post("/api/files/upload", (req, res) => {
  const { name, sizeBytes, category, accountEmail } = req.body;
  if (!name || !sizeBytes || !category) {
    return res.status(400).json({ error: "Missing uploaded file assets." });
  }

  // Pick target routing account
  let targetEmail = accountEmail;
  if (!targetEmail) {
    // smart routable account - pick the synced account with most free space, or "work" as preferred
    const available = accounts.filter((a) => a.status === "synced");
    if (available.length > 0) {
      targetEmail = available[0].email;
    } else {
      targetEmail = "work@company.com";
    }
  }

  const account = accounts.find((a) => a.email === targetEmail);
  if (account) {
    account.usedBytes += parseInt(sizeBytes);
  }

  const newFile: CloudFile = {
    id: `file-${Date.now()}`,
    name,
    path: `/Drive/Uploads/${name}`,
    sizeBytes: parseInt(sizeBytes),
    category: category,
    starred: false,
    modified: "Just now",
    accountEmail: targetEmail,
  };

  files.push(newFile);

  activityLogs.unshift({
    id: `act-${Date.now()}`,
    message: `Quick Upload: ${name}`,
    timestamp: "2m ago",
    iconType: "upload",
    sizeBytes: parseInt(sizeBytes),
    accountEmail: targetEmail,
  });

  res.status(201).json(newFile);
});

// 8. GET DUPLICATES
app.get("/api/duplicates", (req, res) => {
  res.json(getDuplicateGroups());
});

// 9. RESOLVE DUPLICATES
// Keep one master instance, remove standard files for the others and reclaim storage space!
app.post("/api/duplicates/resolve/:groupFilename", (req, res) => {
  const { groupFilename } = req.params;
  const { keepInstanceId } = req.body; // Option to specify which instance to preserve

  const dups = getDuplicateGroups().find((g) => g.filename === groupFilename);
  if (!dups) {
    return res.status(404).json({ error: "Duplicate group not found" });
  }

  // Pick instance to keep; default is the first one
  const targetKeepId = keepInstanceId || dups.instances[0].fileId;

  // For other instances, delete them and reduce space
  const errors: string[] = [];
  dups.instances.forEach((instance) => {
    if (instance.fileId !== targetKeepId) {
      const idx = files.findIndex((f) => f.id === instance.fileId);
      if (idx !== -1) {
        const removed = files[idx];
        files.splice(idx, 1);

        // Reduce account usage
        const acc = accounts.find((a) => a.email === removed.accountEmail);
        if (acc) {
          acc.usedBytes = Math.max(0, acc.usedBytes - removed.sizeBytes);
        }
      }
    }
  });

  activityLogs.unshift({
    id: `act-${Date.now()}`,
    message: `Optimized duplicate group and resolved: ${groupFilename}`,
    timestamp: "Just now",
    iconType: "sync",
    sizeBytes: dups.wastedSizeBytes,
    accountEmail: "all",
  });

  res.json({ success: true, resolvedGroup: groupFilename, reclaimedBytes: dups.wastedSizeBytes });
});

// 10. GET ACTIVITIES
app.get("/api/activities", (req, res) => {
  res.json(activityLogs);
});

// 11. GET STORAGE INTELLIGENCE REPORTS (Waste summary & stale & large)
app.get("/api/intelligence-data", (req, res) => {
  const stale = files.filter((f) => {
    // If it is inside the preset list of stale files
    return f.id.startsWith("file-stale-");
  });

  const largest = [...files]
    .filter((f) => f.sizeBytes > 0)
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, 4);

  const dupGroups = getDuplicateGroups();
  const wastedBytes = dupGroups.reduce((acc, curr) => acc + curr.wastedSizeBytes, 0);

  res.json({
    totalWastedBytes: wastedBytes,
    staleFilesCount: stale.length,
    staleFiles: stale,
    largestFiles: largest,
  });
});

// 12. GEMINI POWERED INTELLIGENCE ADVISOR
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const dupGroups = getDuplicateGroups();
    const stale = files.filter((f) => f.id.startsWith("file-stale-"));
    const totalWastedBytes = dupGroups.reduce((acc, curr) => acc + curr.wastedSizeBytes, 0);

    const accountsSummary = accounts.map(a => `${a.email} (${a.provider}): ${Math.round(a.usedBytes / 1e9)}GB used of ${Math.round(a.quotaBytes / 1e9)}GB`).join("\n");
    const duplicateSummary = dupGroups.map(g => `- Filename: ${g.filename}, wasted: ${Math.round(g.wastedSizeBytes / 1e6)}MB, distributed across: ${g.instances.map(i => i.accountEmail).join(", ")}`).join("\n");
    const staleSummary = stale.map(s => `- Stale draft: ${s.name}, size: ${Math.round(s.sizeBytes / 1e6)}MB, last modified: ${s.modified}`).join("\n");

    const prompt = `You are the CloudVault Storage Intelligence Advisor.
Analyze the user's unified cloud storage and provide an elegant, professional, highly actionable intelligence audit.

Here is the current system telemetry:
**Connected Accounts:**
${accountsSummary}

**Redundant Duplicate Files Detected:** (Total wasted: ${Math.round(totalWastedBytes / 1e6)} MB)
${duplicateSummary || "None"}

**Stale & Stagnant Files Detected:**
${staleSummary || "None"}

Provide your expert response as a clean, highly formatted JSON object. 
Your output MUST strictly follow this JSON schema matching this typescript type:
{
  persona: string; // A high-vibe title for the AI analyzing the files, e.g., "Meticulous Cloud Archivist"
  statusSummary: string; // One brief sentence describing their overall storage health.
  score: number; // A numeric rating from 1 to 100 for storage health
  recommendations: Array<{
    title: string;
    description: string;
    spaceReclaimed: string; // size to save, e.g., "1.2 GB"
  }>;
}

Do not include any extra text or Markdown code blocks outside the JSON itself. Always return valid, parsable JSON.`;

    if (ai) {
      console.log("Calling Gemini API module...");
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.8,
        }
      });

      if (response && response.text) {
        const textResponse = response.text.trim();
        console.log("Raw response from Gemini API:", textResponse);
        // Safely parse JSON
        try {
          const parsed = JSON.parse(textResponse);
          return res.json(parsed);
        } catch (parseError) {
          console.error("Gemini JSON output couldn't be parsed, fallback to fallback generator.", parseError);
        }
      }
    }

    // Default Fallback storage intelligence generator if Gemini is not authorized or crashes
    const estimatedReclaim = (totalWastedBytes / 1024 / 1024 / 1024).toFixed(1);
    const mockAnalysis = {
      persona: "Automated Optimizer Engine",
      statusSummary: `Unified storage looks stable, but we found ${estimatedReclaim} GB of waste that should be purged.`,
      score: 72,
      recommendations: [
        {
          title: "Resolve Redundant Marketing Videos",
          description: "Dup group Q4_Marketing_Promo_Final.mp4 exists simultaneously across your work, personal, and archives. Deduplicating will save immediate space.",
          spaceReclaimed: "1.2 GB"
        },
        {
          title: "Clear Stale Archives",
          description: "File 2021_Tax_Returns_Backup.zip hasn't been accessed since Oct 2021. Cold storage is highly recommended.",
          spaceReclaimed: "1.4 GB"
        },
        {
          title: "Manage Personal Storage Quotas",
          description: "Your personal Google Drive personal@gmail.com is currently at 92% of its maximum capacity. Consider migrating larger items to archive storage.",
          spaceReclaimed: "Under 500 MB"
        }
      ]
    };
    return res.json(mockAnalysis);

  } catch (error) {
    console.error("Intelligence analysis failed:", error);
    res.status(500).json({ error: "Storage Intelligence calculation failed." });
  }
});


// MAIN LAUNCHING ENGINE with Vite integration
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CloudVault server booted up successfully at http://localhost:${PORT}`);
  });
}

startServer();
