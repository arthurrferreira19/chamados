// server/db.js
const mongoose = require("mongoose");

let isConnected = false;
let connectingPromise = null;

async function connectDB() {
  if (isConnected) return;
  if (connectingPromise) return connectingPromise;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("Faltou MONGODB_URI (ou MONGO_URI) nas variáveis de ambiente");

  mongoose.set("strictQuery", true);

  // logs úteis (opcional)
  mongoose.connection.on("connected", () => console.log("[db] conectado"));
  mongoose.connection.on("disconnected", () => console.log("[db] desconectado"));
  mongoose.connection.on("error", (err) => console.log("[db] erro:", err?.message || err));

  const options = {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,

    // evita dor com IPv6 em alguns ambientes cloud
    family: 4
  };

  connectingPromise = mongoose
    .connect(uri, options)
    .then(() => {
      isConnected = true;
      console.log("[db] MongoDB conectado");
    })
    .catch((err) => {
      // libera para novas tentativas
      connectingPromise = null;
      throw err;
    });

  return connectingPromise;
}

/** Counter (auto-increment) */
const CounterSchema = new mongoose.Schema(
  { _id: { type: String, required: true }, seq: { type: Number, default: 0 } },
  { versionKey: false }
);
const Counter = mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

/** Admin */
const AdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password_hash: { type: String, required: true }
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);
const Admin = mongoose.models.Admin || mongoose.model("Admin", AdminSchema);

/** User */
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password_hash: { type: String, required: true },
    must_reset_password: { type: Boolean, default: false, index: true }
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
const User = mongoose.models.User || mongoose.model("User", UserSchema);

/** Ticket */
const TicketSchema = new mongoose.Schema(
  {
    ticket_no: { type: Number, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    requester_name: { type: String, trim: true },
    requester_email: { type: String, lowercase: true, trim: true, index: true },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal", index: true },
    status: { type: String, enum: ["open", "in_progress", "resolved", "closed"], default: "open", index: true },
    assigned_to: { type: String, trim: true }
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

TicketSchema.pre("save", async function (next) {
  try {
    if (this.ticket_no != null) return next();

    const counter = await Counter.findByIdAndUpdate(
      { _id: "ticket_no" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    this.ticket_no = counter.seq;
    return next();
  } catch (e) {
    return next(e);
  }
});
const Ticket = mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema);

/** Notification */
const NotificationSchema = new mongoose.Schema(
  {
    recipient_email: { type: String, required: true, lowercase: true, trim: true, index: true },
    kind: { type: String, enum: ["ticket", "user"], required: true, index: true },
    ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket" },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false, index: true },

    replies: [
      {
        from_role: { type: String, enum: ["user", "admin"], default: "user" },
        message: { type: String, required: true, trim: true },
        created_at: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

NotificationSchema.index({ recipient_email: 1, created_at: -1 });
const Notification = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);

module.exports = { connectDB, Admin, User, Ticket, Notification };
