import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import ImprovedEmployeeCreation from "./ImprovedEmployeeCreation";

export default function EmployeeWorkspace() {
  const userRole = useQuery(api.settings.getUserRole);
  const employees = useQuery(
    api.employees.listEmployees,
    userRole?.role === "admin" ? {} : "skip"
  ) || [];
  const availableLocations = useQuery(api.employees.getAvailableLocations) || [];
  const [selectedEmployee, setSelectedEmployee] = useState<Id<"employees"> | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"employees"> | null>(null);
  const [activeTab, setActiveTab] = useState<"directory" | "activities" | "logs">("directory");
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  const deleteEmployee = useMutation(api.employees.deleteEmployee);
  const updateEmployee = useMutation(api.employees.updateEmployee);
  const resendInvite = useMutation(api.employeesImproved.resendInvite);

  // Employee activities queries for admin - use the new queries that show ALL employees
  const allEmployees = useQuery(api.teams.getAllEmployees) || [];
  const employeeActivities = useQuery(api.teams.getAllEmployeeActivities, {
    staffId: selectedStaff ? (selectedStaff as any) : undefined,
    dateFrom: new Date(dateRange.from).getTime(),
    dateTo: new Date(dateRange.to).getTime() + 24 * 60 * 60 * 1000 - 1,
    limit: 100,
  });
  const employeeShiftSummary = useQuery(api.teams.getAllEmployeeShiftSummary, {
    dateFrom: new Date(dateRange.from).getTime(),
    dateTo: new Date(dateRange.to).getTime() + 24 * 60 * 60 * 1000 - 1,
  });
  
  // Get all logs for admin view
  const allLogs = useQuery(api.care.getResidentLogs, { limit: 200 });

  const [editEmployeeForm, setEditEmployeeForm] = useState({
    name: "",
    email: "",
    role: "staff" as "admin" | "supervisor" | "staff",
    locations: [] as string[],
  });

  async function handleDeleteEmployee(employeeId: Id<"employees">) {
    if (!window.confirm("Are you sure you want to delete this employee? This action cannot be undone.")) {
      return;
    }
    setDeletingId(employeeId);
    try {
      await deleteEmployee({ employeeId });
      toast.success("Employee deleted.");
      if (selectedEmployee === employeeId) setSelectedEmployee(null);
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete employee");
    } finally {
      setDeletingId(null);
    }
  }

  const handleEditEmployee = (employee: any) => {
    setEditEmployeeForm({
      name: employee.name,
      email: employee.email || employee.workEmail,
      role: employee.role || "staff",
      locations: employee.locations || [],
    });
    setSelectedEmployee(employee.id);
    setShowEditForm(true);
  };

  const handleEditLocationToggle = (location: string) => {
    setEditEmployeeForm(prev => ({
      ...prev,
      locations: prev.locations.includes(location)
        ? prev.locations.filter(l => l !== location)
        : [...prev.locations, location]
    }));
  };

  async function handleUpdateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    try {
      await updateEmployee({
        employeeId: selectedEmployee,
        name: editEmployeeForm.name,
        email: editEmployeeForm.email,
        role: editEmployeeForm.role,
        locations: editEmployeeForm.locations,
      });
      setShowEditForm(false);
      setSelectedEmployee(null);
      toast.success("Employee updated successfully!");
    } catch (error) {
      toast.error("Failed to update employee");
    }
  }

  async function handleResendInvite(employeeId: Id<"employees">) {
    try {
      const result = await resendInvite({ employeeId });
      toast.success(result.message || "Invite resent successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend invite");
    }
  }

  const isAdmin = userRole?.role === "admin";

  // Helper function to format log content like the dashboard
  const formatLogContent = (content: string, template: string | undefined) => {
    try {
      const parsed = JSON.parse(content);
      if (template === "daily_notes") {
        return `Mood: ${parsed.mood || "N/A"}, Activities: ${parsed.activities || "N/A"}`;
      } else if (template === "incident_report") {
        return `${parsed.incident_type || "Incident"}: ${parsed.description || "No description"}`;
      } else if (template === "medication_log") {
        return `${parsed.medication || "Medication"} - ${parsed.dosage || "N/A"}`;
      } else if (template === "care_plan_update") {
        return `${parsed.area || "Care"}: ${parsed.update || "No update"}`;
      }
      return content.substring(0, 120) + (content.length > 120 ? "..." : "");
    } catch {
      return content.substring(0, 120) + (content.length > 120 ? "..." : "");
    }
  };

  const renderActivitiesTab = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Activity Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All employees</option>
              {allEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Employee Activities */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Employee Activities</h3>
        </div>
        <div className="p-6">
          {!employeeActivities || employeeActivities.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-gray-500 text-lg font-medium mb-2">No activities found</p>
              <p className="text-gray-400">Activities will appear here once employees start working</p>
            </div>
          ) : (
            <div className="space-y-4">
              {employeeActivities.map((activity, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{activity.authorName}</p>
                      <p className="text-sm text-gray-600">{activity.template}</p>
                      <p className="text-xs text-gray-500">{activity.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-900">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shift Summary */}
      {employeeShiftSummary && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Shift Summary</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(employeeShiftSummary).map(([employeeId, summary]: [string, any]) => (
                <div key={employeeId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">{summary.employeeName}</h4>
                    <span className="text-sm text-gray-500">{summary.role}</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium text-gray-700">Total Hours:</span>
                      <p className="text-gray-900">{(summary.totalHours || 0).toFixed(1)}h</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Shifts:</span>
                      <p className="text-gray-900">{summary.shiftCount || 0}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Locations:</span>
                      <p className="text-gray-900">{(summary.locations || []).join(", ") || "None"}</p>
                    </div>
                    {summary.lastActivity && (
                      <div>
                        <span className="font-medium text-gray-700">Last Active:</span>
                        <p className="text-gray-900">
                          {new Date(summary.lastActivity).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {activeTab === "directory" ? `Employees (${employees.length})` : 
           activeTab === "activities" ? "Employee Activities" : "All Care Logs"}
        </h2>
        {activeTab === "directory" && (
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? "Cancel" : "Add Employee"}
          </button>
        )}
      </div>

      {/* Tab Navigation - Only show for admins */}
      {isAdmin && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: "directory", label: "Employee Directory", icon: "👥" },
              { id: "activities", label: "Employee Activities", icon: "📊" },
              { id: "logs", label: "All Logs", icon: "📝" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Directory Tab Content */}
      {activeTab === "directory" && (
        <>
          {/* Improved Add Employee Form */}
          {showAddForm && (
            <ImprovedEmployeeCreation
              onSuccess={() => {
                setShowAddForm(false);
                toast.success("Employee invite sent successfully!");
              }}
              onCancel={() => setShowAddForm(false)}
              availableLocations={availableLocations}
            />
          )}

          {/* Edit Employee Form */}
          {showEditForm && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Edit Employee</h3>
              <form onSubmit={handleUpdateEmployee} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={editEmployeeForm.name}
                      onChange={(e) => setEditEmployeeForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      value={editEmployeeForm.email}
                      onChange={(e) => setEditEmployeeForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role *
                  </label>
                  <select
                    value={editEmployeeForm.role}
                    onChange={(e) => setEditEmployeeForm(prev => ({ ...prev, role: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="staff">Staff</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assigned Locations
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {availableLocations.map((location: string) => (
                      <label key={location} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={editEmployeeForm.locations.includes(location)}
                          onChange={() => handleEditLocationToggle(location)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{location}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditForm(false);
                      setSelectedEmployee(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    Update Employee
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Employees List */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Employee Directory</h3>
            </div>
            
            {employees.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-4">👥</div>
                <p className="text-lg font-medium mb-2">No employees yet</p>
                <p className="text-sm">Add your first employee to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {employees.map((emp) => (
                  <div key={emp.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div className="flex-1">
                            <h4 className="text-lg font-medium text-gray-900">{emp.name}</h4>
                            <p className="text-sm text-gray-600">{emp.workEmail}</p>
                            <div className="flex items-center space-x-4 mt-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                emp.role === "admin" ? "bg-red-100 text-red-800" :
                                emp.role === "supervisor" ? "bg-yellow-100 text-yellow-800" :
                                "bg-green-100 text-green-800"
                              }`}>
                                {emp.role || "staff"}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                emp.employmentStatus === "active" ? "bg-green-100 text-green-800" : 
                                emp.employmentStatus === "pending" ? "bg-yellow-100 text-yellow-800" :
                                "bg-gray-100 text-gray-800"
                              }`}>
                                {emp.employmentStatus === "active" ? "Active" : 
                                 emp.employmentStatus === "pending" ? "Pending Invite" : "Inactive"}
                              </span>
                              {!emp.hasAcceptedInvite && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  Invite Pending
                                </span>
                              )}
                            </div>
                            <div className="mt-2">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Locations:</span> {emp.locations.join(", ") || "None assigned"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        {!emp.hasAcceptedInvite && (
                          <button
                            onClick={() => handleResendInvite(emp.id)}
                            className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                          >
                            Resend Invite
                          </button>
                        )}
                        <button
                          onClick={() => handleEditEmployee(emp)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.id)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                          disabled={deletingId === emp.id}
                        >
                          {deletingId === emp.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Activities Tab Content */}
      {activeTab === "activities" && isAdmin && renderActivitiesTab()}

      {/* All Logs Tab Content */}
      {activeTab === "logs" && isAdmin && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">All Care Logs ({(allLogs || []).length})</h3>
          </div>
          <div className="p-6">
            {!allLogs || allLogs.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📝</div>
                <p className="text-gray-500 text-lg font-medium mb-2">No logs found</p>
                <p className="text-gray-400">Care logs will appear here once staff start documenting</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {allLogs.slice(0, 100).map((log) => (
                  <div key={log.id} className="border-l-4 border-blue-200 pl-4 hover:bg-gray-50 transition-colors rounded-r-lg py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">
                            {log.template === "daily_notes" ? "📝" : 
                             log.template === "incident_report" ? "⚠️" : 
                             log.template === "medication_log" ? "💊" : 
                             log.template === "care_plan_update" ? "📋" : "📄"}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            log.template === "daily_notes" ? "bg-blue-100 text-blue-800" :
                            log.template === "incident_report" ? "bg-red-100 text-red-800" :
                            log.template === "medication_log" ? "bg-green-100 text-green-800" :
                            log.template === "care_plan_update" ? "bg-purple-100 text-purple-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {log.template?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || "Unknown"}
                          </span>

                        </div>
                        <p className="font-medium text-sm">{log.residentName}</p>
                        <p className="text-xs text-gray-600 mb-2">{log.residentLocation}</p>
                        <p className="text-sm text-gray-700">
                          {formatLogContent(log.content, log.template)}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-xs text-gray-500">
                          {log.authorName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
