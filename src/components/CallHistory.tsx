"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";

// ============= ICONS =============
const PhoneIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);
const ClockIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const ChevronLeftIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const MailIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
const TrashIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// ============= HELPERS =============
const CALL_TYPE_COLORS: Record<string, string> = {
  design: "bg-emerald-100 text-emerald-800",
  service: "bg-blue-100 text-blue-800",
  quote: "bg-amber-100 text-amber-800",
  emergency: "bg-red-100 text-red-800",
  general: "bg-gray-100 text-gray-800",
  unknown: "bg-gray-100 text-gray-500",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  transferred: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim();
}

const PhoneOutgoingIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3h5m0 0v5m0-5l-6 6M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const DIRECTION_COLORS: Record<string, string> = {
  outbound: "bg-purple-100 text-purple-800",
  inbound: "bg-teal-100 text-teal-800",
};

// ============= COMPONENT =============
export default function CallHistory() {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showDialer, setShowDialer] = useState(false);
  const [dialNumber, setDialNumber] = useState("");
  const [dialName, setDialName] = useState("");
  const [dialCallType, setDialCallType] = useState("unknown");
  const [dialError, setDialError] = useState("");

  // Queries
  const statsQuery = trpc.calls.getCallStats.useQuery();
  const listQuery = trpc.calls.listCalls.useQuery({
    callType: filterType || undefined,
    status: filterStatus || undefined,
    limit: 50,
  });
  const detailQuery = trpc.calls.getCall.useQuery(
    { id: selectedCallId! },
    { enabled: !!selectedCallId }
  );

  // Mutations
  const deleteCall = trpc.calls.deleteCall.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      statsQuery.refetch();
      setSelectedCallId(null);
    },
  });
  const resendAudit = trpc.calls.resendAudit.useMutation();
  const initiateCall = trpc.calls.initiateCall.useMutation({
    onSuccess: () => {
      setShowDialer(false);
      setDialNumber("");
      setDialName("");
      setDialCallType("unknown");
      setDialError("");
      listQuery.refetch();
      statsQuery.refetch();
    },
    onError: (err) => {
      setDialError(err.message);
    },
  });

  const stats = statsQuery.data;
  const calls = listQuery.data?.calls || [];
  const detail = detailQuery.data;

  // If detail view is shown
  if (selectedCallId && detail) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="p-6 max-w-4xl mx-auto"
      >
        {/* Back button */}
        <button
          onClick={() => setSelectedCallId(null)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-black mb-6 transition-colors"
        >
          {ChevronLeftIcon}
          <span>Back to call list</span>
        </button>

        {/* Call Header */}
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">
                {detail.callerName || detail.callerNumber}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{detail.callerNumber}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${DIRECTION_COLORS[(detail as Record<string, unknown>).direction as string] || DIRECTION_COLORS.outbound}`}>
                {((detail as Record<string, unknown>).direction as string || "outbound") === "outbound" ? "Outbound" : "Inbound"}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${CALL_TYPE_COLORS[detail.callType || "unknown"]}`}>
                {(detail.callType || "Unknown").charAt(0).toUpperCase() + (detail.callType || "unknown").slice(1)}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[detail.status] || STATUS_COLORS.completed}`}>
                {detail.status.charAt(0).toUpperCase() + detail.status.slice(1)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 text-xs uppercase tracking-wider">Date</span>
              <p className="font-medium">{formatDate(detail.startedAt)}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs uppercase tracking-wider">Time</span>
              <p className="font-medium">{formatTime(detail.startedAt)}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs uppercase tracking-wider">Duration</span>
              <p className="font-medium">{formatDuration(detail.duration)}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs uppercase tracking-wider">Turns</span>
              <p className="font-medium">{detail.turns.length}</p>
            </div>
          </div>

          {detail.callerEmail && (
            <p className="text-sm mt-3 text-gray-600">Email: {detail.callerEmail}</p>
          )}
          {detail.callerAddress && (
            <p className="text-sm text-gray-600">Address: {detail.callerAddress}</p>
          )}
          {detail.summary && (
            <div className="mt-4 p-3 bg-emerald-50 rounded-lg text-sm text-emerald-800">
              <strong>Summary:</strong> {detail.summary}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={() => resendAudit.mutate({ id: detail.id })}
              disabled={resendAudit.isPending}
              className="btn text-xs flex items-center gap-1.5"
            >
              {MailIcon}
              {resendAudit.isPending ? "Sending..." : resendAudit.isSuccess ? "Sent!" : "Re-send Audit Email"}
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this call record?")) {
                  deleteCall.mutate({ id: detail.id });
                }
              }}
              className="btn text-xs flex items-center gap-1.5 text-red-600 hover:bg-red-50"
            >
              {TrashIcon}
              Delete
            </button>
          </div>
        </div>

        {/* Intake Data */}
        {detail.intakeData && (() => {
          try {
            const data = JSON.parse(detail.intakeData);
            const entries = Object.entries(data).filter(([, v]) => v);
            if (entries.length === 0) return null;
            return (
              <div className="card p-6 mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">
                  Collected Intake Data
                </h3>
                <div className="space-y-2">
                  {entries.map(([key, value]) => (
                    <div key={key} className="flex border-b border-gray-50 pb-2">
                      <span className="text-sm font-medium text-gray-500 w-40 flex-shrink-0">
                        {formatLabel(key)}
                      </span>
                      <span className="text-sm text-gray-900">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          } catch {
            return null;
          }
        })()}

        {/* Transcript */}
        {detail.turns.length > 0 && (
          <div className="card p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">
              Full Transcript
            </h3>
            <div className="space-y-3">
              {detail.turns.map((turn) => (
                <div key={turn.id} className="flex gap-3">
                  <div className={`w-2 rounded-full flex-shrink-0 ${turn.role === "agent" ? "bg-emerald-500" : "bg-blue-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold ${turn.role === "agent" ? "text-emerald-700" : "text-blue-700"}`}>
                        {turn.role === "agent" ? "Agent" : "Caller"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTime(turn.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{turn.content}</p>
                    {turn.extractedData && (() => {
                      try {
                        const data = JSON.parse(turn.extractedData);
                        const entries = Object.entries(data).filter(([, v]) => v);
                        if (entries.length === 0) return null;
                        return (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {entries.map(([k, v]) => (
                              <span key={k} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full">
                                {formatLabel(k)}: {String(v).slice(0, 30)}
                              </span>
                            ))}
                          </div>
                        );
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // ============= LIST VIEW =============
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              {PhoneIcon}
              Call History
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              AI phone agent — outbound intake calls and audit records
            </p>
          </div>
          <button
            onClick={() => setShowDialer(!showDialer)}
            className="btn btn-primary text-sm flex items-center gap-2"
          >
            {PhoneOutgoingIcon}
            New Call
          </button>
        </div>

        {/* Dialer Panel */}
        <AnimatePresence>
          {showDialer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="card p-5 mt-4 border-emerald-200">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Initiate Outbound Call
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Phone Number *</label>
                    <input
                      type="tel"
                      value={dialNumber}
                      onChange={(e) => setDialNumber(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="input text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Contact Name</label>
                    <input
                      type="text"
                      value={dialName}
                      onChange={(e) => setDialName(e.target.value)}
                      placeholder="John Smith"
                      className="input text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Call Type</label>
                    <select
                      value={dialCallType}
                      onChange={(e) => setDialCallType(e.target.value)}
                      className="input text-sm w-full"
                    >
                      <option value="unknown">Auto-detect</option>
                      <option value="design">Design Consultation</option>
                      <option value="service">Service Request</option>
                      <option value="quote">Quote</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        if (!dialNumber.trim()) {
                          setDialError("Phone number is required");
                          return;
                        }
                        setDialError("");
                        initiateCall.mutate({
                          phoneNumber: dialNumber.trim(),
                          callType: dialCallType !== "unknown" ? dialCallType : undefined,
                          callerName: dialName.trim() || undefined,
                        });
                      }}
                      disabled={initiateCall.isPending}
                      className="btn btn-primary text-sm w-full flex items-center justify-center gap-2"
                    >
                      {initiateCall.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                          Dialing...
                        </>
                      ) : (
                        <>
                          {PhoneOutgoingIcon}
                          Dial
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {dialError && (
                  <p className="text-xs text-red-600 mt-2">{dialError}</p>
                )}
                {initiateCall.isSuccess && (
                  <p className="text-xs text-emerald-600 mt-2">Call initiated successfully! Check the list below.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Stats Bar */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Calls</p>
            <p className="text-2xl font-bold mt-1">{stats.totalCalls}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Today</p>
            <p className="text-2xl font-bold mt-1">{stats.callsToday}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Avg Duration</p>
            <p className="text-2xl font-bold mt-1">{formatDuration(stats.avgDuration)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">By Type</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(stats.byType).map(([type, count]) => (
                <span key={type} className={`px-2 py-0.5 rounded-full text-xs font-medium ${CALL_TYPE_COLORS[type] || CALL_TYPE_COLORS.unknown}`}>
                  {type}: {count as number}
                </span>
              ))}
              {Object.keys(stats.byType).length === 0 && (
                <span className="text-xs text-gray-400">No calls yet</span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex gap-3 mb-4"
      >
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="input text-sm py-1.5 w-40"
        >
          <option value="">All Types</option>
          <option value="design">Design</option>
          <option value="service">Service</option>
          <option value="quote">Quote</option>
          <option value="emergency">Emergency</option>
          <option value="general">General</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input text-sm py-1.5 w-40"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </motion.div>

      {/* Call List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {listQuery.isLoading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-black border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading calls...</p>
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-16 card">
            <div className="text-4xl mb-4 opacity-30">{PhoneIcon}</div>
            <h3 className="text-lg font-medium text-gray-600">No calls yet</h3>
            <p className="text-sm text-gray-400 mt-2">
              Click "New Call" above to initiate an outbound AI intake call.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {calls.map((call, i) => (
                <motion.div
                  key={call.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedCallId(call.id)}
                  className="card p-4 cursor-pointer hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        {PhoneIcon}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {call.callerName || call.callerNumber}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(call.startedAt)} at {formatTime(call.startedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DIRECTION_COLORS[(call as Record<string, unknown>).direction as string] || DIRECTION_COLORS.outbound}`}>
                        {((call as Record<string, unknown>).direction as string || "outbound") === "outbound" ? "Outbound" : "Inbound"}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CALL_TYPE_COLORS[call.callType || "unknown"]}`}>
                        {(call.callType || "?").charAt(0).toUpperCase() + (call.callType || "?").slice(1)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[call.status] || STATUS_COLORS.completed}`}>
                        {call.status}
                      </span>
                      {call.duration != null && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          {ClockIcon}
                          {formatDuration(call.duration)}
                        </span>
                      )}
                      {call.auditPdfSent && (
                        <span className="text-emerald-500" title="Audit email sent">
                          {MailIcon}
                        </span>
                      )}
                    </div>
                  </div>

                  {call.summary && (
                    <p className="text-xs text-gray-500 mt-2 ml-13 truncate">{call.summary}</p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
