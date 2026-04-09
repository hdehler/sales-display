import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),

  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || "",
    appToken: process.env.SLACK_APP_TOKEN || "",
    salesChannelId: process.env.SLACK_SALES_CHANNEL_ID || "",
  },

  plugs: {
    hosts: (process.env.KASA_PLUG_HOSTS || "")
      .split(",")
      .filter(Boolean),
    autoDiscover: process.env.KASA_AUTO_DISCOVER !== "false",
  },

  celebration: {
    defaultDuration: parseInt(process.env.CELEBRATION_DURATION || "30", 10),
    triggerProducts: (process.env.CELEBRATION_TRIGGER_PRODUCTS || "")
      .split(",")
      .filter(Boolean),
    milestoneInterval: parseInt(process.env.MILESTONE_INTERVAL || "10", 10),
  },

  messagePatterns: [
    {
      regex: /\$([0-9,.]+)\s+(?:sale\s+)?(?:to|from)\s+(.+?)\s+(?:by|-)\s+(.+?)(?:\s*[-–—]\s*(.+))?$/i,
      groups: { amount: 1, customer: 2, rep: 3, product: 4 },
    },
    {
      regex: /(.+?)\s+closed\s+\$([0-9,.]+)\s+(?:with|from)\s+(.+?)(?:\s*\((.+?)\))?$/i,
      groups: { rep: 1, amount: 2, customer: 3, product: 4 },
    },
    {
      regex: /(?:new\s+)?sale[:\s]+\$([0-9,.]+)\s*[-–—]\s*(.+?)\s*\((.+?)\)(?:\s*[-–—]\s*(.+))?$/i,
      groups: { amount: 1, customer: 2, rep: 3, product: 4 },
    },
  ] as const,
};
