# Step-by-Step Guide: How to Add a New Module to CMS
**HUDERMA Specialty Clinic Management System**

[← Back to Developer Handbook](../DEVELOPER_HANDBOOK.md)

This guide provides an end-to-end recipe for creating and integrating a brand new module into the CMS from scratch without Antigravity. 

We will use a concrete example throughout this guide: **Patient Feedback & Satisfaction Management** (`PatientFeedback`), allowing the clinic to collect patient satisfaction ratings, comments, and complaints, and track staff resolution.

---

## 📋 The 11-Step Recipe Checklist

| Step | Layer | File to Create or Edit | Purpose |
|:---|:---|:---|:---|
| **Step 1** | Database | `database/migrations/xxx_add_feedback.sql` | Create the SQL Server table with indexes and constraints. |
| **Step 2** | Domain | `src/CMS.Domain/Entities/ExtendedEntities.cs` | Define the C# entity class representing the business model. |
| **Step 3** | Shared | `src/CMS.Shared/DTOs/ExtendedDTOs.cs` | Create Request and Response DTOs for client-server communication. |
| **Step 4** | Infrastructure | `src/CMS.Infrastructure/Data/AppDbContext.cs` | Register `DbSet<PatientFeedback>` and configure EF Core table mapping. |
| **Step 5** | Domain Interfaces| `src/CMS.Domain/Interfaces/IServiceInterfaces.cs` | Declare interface methods for the feedback service. |
| **Step 6** | Application | `src/CMS.Application/Feedback/FeedbackService.cs` | Implement business logic (validation, filtering, database queries). |
| **Step 7** | API DI | `src/CMS.API/Program.cs` | Register the new service in ASP.NET Core dependency injection container. |
| **Step 8** | API Controller | `src/CMS.API/Controllers/FeedbackController.cs` | Expose REST endpoints with authorization rules. |
| **Step 9** | Frontend Page | `frontend/cms-web/src/pages/Feedback/FeedbackPage.tsx` | Create the React user interface with data table and submission modal. |
| **Step 10**| Navigation & RBAC| `Sidebar.tsx` & `utils/permissions.ts` | Add the navigation icon, menu item, and role permissions. |
| **Step 11**| App Routing | `frontend/cms-web/src/App.tsx` | Wire up the new module view state so it displays when clicked. |

---

## 🛠️ Step-by-Step Walkthrough with Code Snippets

---

### Step 1: Database Migration (SQL Server)
Create a new migration script file: `database/migrations/010_add_patient_feedback.sql`

```sql
-- Step 1: Create the PatientFeedback table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PatientFeedbacks')
BEGIN
    CREATE TABLE [dbo].[PatientFeedbacks] (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [PatientId] INT NOT NULL,
        [EncounterId] INT NULL,
        [Rating] INT NOT NULL CHECK ([Rating] BETWEEN 1 AND 5),
        [Category] NVARCHAR(50) NOT NULL DEFAULT 'General', -- 'Doctor', 'Pharmacy', 'Lab', 'Billing', 'Facility'
        [Comments] NVARCHAR(1000) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT 'Submitted', -- 'Submitted', 'UnderReview', 'Resolved'
        [ResolutionNotes] NVARCHAR(1000) NULL,
        [ResolvedByUserId] INT NULL,
        [ResolvedAt] DATETIME2 NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [IsDeleted] BIT NOT NULL DEFAULT 0,

        CONSTRAINT [FK_PatientFeedbacks_Patients] FOREIGN KEY ([PatientId]) REFERENCES [dbo].[Patients]([Id]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_PatientFeedbacks_PatientId] ON [dbo].[PatientFeedbacks]([PatientId]);
    CREATE INDEX [IX_PatientFeedbacks_Status] ON [dbo].[PatientFeedbacks]([Status]);
END
GO
```

---

### Step 2: C# Domain Entity (`CMS.Domain`)
Open or add to `src/CMS.Domain/Entities/ExtendedEntities.cs`:

```csharp
namespace CMS.Domain.Entities;

/// <summary>
/// Represents patient satisfaction feedback or complaint for a visit.
/// </summary>
public class PatientFeedback
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public int? EncounterId { get; set; }
    public int Rating { get; set; } // 1 (Poor) to 5 (Excellent)
    public string Category { get; set; } = "General";
    public string? Comments { get; set; }
    public string Status { get; set; } = "Submitted"; // Submitted, UnderReview, Resolved
    public string? ResolutionNotes { get; set; }
    public int? ResolvedByUserId { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;

    // Navigation property
    public virtual Patient Patient { get; set; } = null!;
}
```

---

### Step 3: Shared DTOs (`CMS.Shared`)
Open or add to `src/CMS.Shared/DTOs/ExtendedDTOs.cs`:

```csharp
namespace CMS.Shared.DTOs;

public class CreateFeedbackDto
{
    public int PatientId { get; set; }
    public int? EncounterId { get; set; }
    public int Rating { get; set; }
    public string Category { get; set; } = "General";
    public string? Comments { get; set; }
}

public class ResolveFeedbackDto
{
    public string ResolutionNotes { get; set; } = string.Empty;
}

public class PatientFeedbackDto
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string PatientMrn { get; set; } = string.Empty;
    public int? EncounterId { get; set; }
    public int Rating { get; set; }
    public string Category { get; set; } = string.Empty;
    public string? Comments { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ResolutionNotes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}
```

---

### Step 4: Register in EF Core DbContext (`CMS.Infrastructure`)
In `src/CMS.Infrastructure/Data/AppDbContext.cs`, add the `DbSet` property:

```csharp
// Inside AppDbContext class:
public DbSet<PatientFeedback> PatientFeedbacks => Set<PatientFeedback>();
```

And optionally in `OnModelCreating(ModelBuilder modelBuilder)`:
```csharp
modelBuilder.Entity<PatientFeedback>(b =>
{
    b.ToTable("PatientFeedbacks");
    b.HasQueryFilter(f => !f.IsDeleted); // Global soft-delete filter
});
```

---

### Step 5: Declare Interface (`CMS.Domain/Interfaces`)
In `src/CMS.Domain/Interfaces/IServiceInterfaces.cs`, add:

```csharp
public interface IFeedbackService
{
    Task<IEnumerable<PatientFeedbackDto>> GetAllFeedbackAsync(string? status = null);
    Task<PatientFeedbackDto> CreateFeedbackAsync(CreateFeedbackDto dto);
    Task<bool> ResolveFeedbackAsync(int feedbackId, int staffUserId, ResolveFeedbackDto dto);
}
```

---

### Step 6: Implement Business Service (`CMS.Application`)
Create a new file `src/CMS.Application/Feedback/FeedbackService.cs`:

```csharp
using CMS.Domain.Entities;
using CMS.Domain.Interfaces;
using CMS.Infrastructure.Data;
using CMS.Shared.DTOs;
using Microsoft.EntityFrameworkCore;

namespace CMS.Application.Feedback;

public class FeedbackService : IFeedbackService
{
    private readonly AppDbContext _db;

    public FeedbackService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IEnumerable<PatientFeedbackDto>> GetAllFeedbackAsync(string? status = null)
    {
        var query = _db.PatientFeedbacks
            .Include(f => f.Patient)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(f => f.Status == status);

        return await query
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new PatientFeedbackDto
            {
                Id = f.Id,
                PatientId = f.PatientId,
                PatientName = f.Patient.FirstName + " " + f.Patient.LastName,
                PatientMrn = f.Patient.Mrn,
                EncounterId = f.EncounterId,
                Rating = f.Rating,
                Category = f.Category,
                Comments = f.Comments,
                Status = f.Status,
                ResolutionNotes = f.ResolutionNotes,
                CreatedAt = f.CreatedAt,
                ResolvedAt = f.ResolvedAt
            })
            .ToListAsync();
    }

    public async Task<PatientFeedbackDto> CreateFeedbackAsync(CreateFeedbackDto dto)
    {
        var entity = new PatientFeedback
        {
            PatientId = dto.PatientId,
            EncounterId = dto.EncounterId,
            Rating = Math.Clamp(dto.Rating, 1, 5),
            Category = string.IsNullOrWhiteSpace(dto.Category) ? "General" : dto.Category,
            Comments = dto.Comments,
            Status = "Submitted",
            CreatedAt = DateTime.UtcNow
        };

        _db.PatientFeedbacks.Add(entity);
        await _db.SaveChangesAsync();

        return new PatientFeedbackDto
        {
            Id = entity.Id,
            PatientId = entity.PatientId,
            Rating = entity.Rating,
            Category = entity.Category,
            Comments = entity.Comments,
            Status = entity.Status,
            CreatedAt = entity.CreatedAt
        };
    }

    public async Task<bool> ResolveFeedbackAsync(int feedbackId, int staffUserId, ResolveFeedbackDto dto)
    {
        var feedback = await _db.PatientFeedbacks.FindAsync(feedbackId);
        if (feedback == null) return false;

        feedback.Status = "Resolved";
        feedback.ResolutionNotes = dto.ResolutionNotes;
        feedback.ResolvedByUserId = staffUserId;
        feedback.ResolvedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return true;
    }
}
```

---

### Step 7: Register in Dependency Injection (`CMS.API/Program.cs`)
Open `src/CMS.API/Program.cs` and add:

```csharp
// Add after the other service registrations:
builder.Services.AddScoped<IFeedbackService, FeedbackService>();
```

---

### Step 8: Create API Controller (`CMS.API/Controllers`)
Create a new file `src/CMS.API/Controllers/FeedbackController.cs`:

```csharp
using System.Security.Claims;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize] // Requires login
public class FeedbackController : ControllerBase
{
    private readonly IFeedbackService _feedbackService;

    public FeedbackController(IFeedbackService feedbackService)
    {
        _feedbackService = feedbackService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status)
    {
        var items = await _feedbackService.GetAllFeedbackAsync(status);
        return Ok(new { success = true, data = items });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateFeedbackDto dto)
    {
        if (dto.PatientId <= 0)
            return BadRequest(new { success = false, message = "Valid PatientId is required." });

        var result = await _feedbackService.CreateFeedbackAsync(dto);
        return Ok(new { success = true, data = result });
    }

    [HttpPut("{id:int}/resolve")]
    [Authorize(Roles = "Admin,Doctor,Nurse")]
    public async Task<IActionResult> Resolve(int id, [FromBody] ResolveFeedbackDto dto)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0";
        _ = int.TryParse(userIdStr, out var userId);

        var ok = await _feedbackService.ResolveFeedbackAsync(id, userId, dto);
        if (!ok) return NotFound(new { success = false, message = "Feedback not found." });

        return Ok(new { success = true, message = "Feedback resolved successfully." });
    }
}
```

---

### Step 9: Frontend React Component (`frontend/cms-web/src/pages/`)
Create `frontend/cms-web/src/pages/Feedback/FeedbackPage.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api/apiClient';
import { Star, MessageSquare, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

interface FeedbackItem {
  id: number;
  patientId: number;
  patientName: string;
  patientMrn: string;
  rating: number;
  category: string;
  comments: string;
  status: string;
  resolutionNotes?: string;
  createdAt: string;
}

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const loadFeedbacks = async () => {
    setLoading(true);
    try {
      const url = selectedStatus ? `/api/v1/feedback?status=${selectedStatus}` : '/api/v1/feedback';
      const res = await api.get<{ success: boolean; data: FeedbackItem[] }>(url);
      if (res.data?.success) setFeedbacks(res.data.data);
    } catch (err) {
      console.error('Failed to load feedback', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbacks();
  }, [selectedStatus]);

  const handleResolve = async (id: number) => {
    const note = window.prompt('Enter resolution note:');
    if (!note) return;
    try {
      await api.put(`/api/v1/feedback/${id}/resolve`, { resolutionNotes: note });
      loadFeedbacks();
    } catch {
      alert('Failed to resolve feedback');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Patient Feedback & Satisfaction</h1>
          <p className="text-sm text-gray-500">Monitor ratings, clinical experience feedback, and complaints</p>
        </div>
        <button
          onClick={loadFeedbacks}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {['', 'Submitted', 'Resolved'].map((st) => (
          <button
            key={st}
            onClick={() => setSelectedStatus(st)}
            className={`pb-2 px-3 text-sm font-medium ${
              selectedStatus === st ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
            }`}
          >
            {st === '' ? 'All Feedback' : st}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
            <tr>
              <th className="p-4">Date</th>
              <th className="p-4">Patient</th>
              <th className="p-4">Rating</th>
              <th className="p-4">Category</th>
              <th className="p-4">Comments</th>
              <th className="p-4">Status</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {feedbacks.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">No feedback found.</td></tr>
            ) : (
              feedbacks.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="p-4 text-gray-500">{new Date(f.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 font-medium text-gray-800">{f.patientName} ({f.patientMrn})</td>
                  <td className="p-4">
                    <span className="flex items-center text-yellow-500 font-bold">
                      {f.rating} <Star className="w-4 h-4 ml-1 fill-yellow-400" />
                    </span>
                  </td>
                  <td className="p-4"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{f.category}</span></td>
                  <td className="p-4 max-w-xs truncate text-gray-600">{f.comments || '—'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      f.status === 'Resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {f.status !== 'Resolved' && (
                      <button
                        onClick={() => handleResolve(f.id)}
                        className="text-xs text-blue-600 hover:underline font-semibold"
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

### Step 10: Register Navigation & Permissions
1. In `frontend/cms-web/src/components/Sidebar.tsx`:
   - Add `'FEEDBACK'` to `export type ModuleKey`:
     ```typescript
     export type ModuleKey = 'DASHBOARD' | 'PATIENTS' | ... | 'FEEDBACK';
     ```
   - Add to `MODULE_ITEMS` array:
     ```typescript
     { key: 'FEEDBACK', label: 'Patient Feedback', icon: MessageSquare, roles: ['Admin', 'Doctor', 'Nurse', 'Receptionist'] },
     ```
2. In `frontend/cms-web/src/utils/permissions.ts`:
   - Ensure the roles permitted to view `'FEEDBACK'` match your clinic's access policy.

---

### Step 11: Route in `App.tsx`
1. Open `frontend/cms-web/src/App.tsx`.
2. Import the new page:
   ```tsx
   import FeedbackPage from './pages/Feedback/FeedbackPage';
   ```
3. Inside the `renderMainContent()` or `activeModule` switch case:
   ```tsx
   {activeModule === 'FEEDBACK' && <FeedbackPage />}
   ```

---

## 🏆 You're Done!
Recompile and test:
```powershell
dotnet build CMS.sln
cd frontend\cms-web
npm run build
```
Once built, refresh your browser: the new "Patient Feedback" option will appear in your sidebar, complete with security, role filtering, database persistence, and API endpoints!
