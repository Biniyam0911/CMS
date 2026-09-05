using CMS.Application.Billing;
using CMS.Application.Laboratory;
using CMS.Application.Notifications;
using CMS.Application.Pharmacy;
using CMS.Shared.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class PharmacyController : ControllerBase
{
    private readonly PharmacyService _pharmacyService;

    public PharmacyController(PharmacyService pharmacyService)
    {
        _pharmacyService = pharmacyService;
    }

    [HttpGet("formulary")]
    public async Task<IActionResult> GetFormulary()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var drugs = await _pharmacyService.GetFormularyAsync(tenantId);
        return Ok(ApiResponse<List<DrugFormularyDto>>.Ok(drugs));
    }

    [HttpGet("prescriptions")]
    public async Task<IActionResult> GetPrescriptions()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var prescriptions = await _pharmacyService.GetPrescriptionsAsync(tenantId);
        return Ok(ApiResponse<List<PrescriptionDto>>.Ok(prescriptions));
    }

    [HttpPost("restock")]
    public async Task<IActionResult> Restock([FromBody] RestockDrugDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        await _pharmacyService.RestockDrugAsync(tenantId, dto, 1);
        return Ok(ApiResponse<string>.Ok("Drug restocked successfully."));
    }

    [HttpPost("prescriptions")]
    public async Task<IActionResult> CreatePrescription([FromBody] CreatePrescriptionDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        int prescriptionId = await _pharmacyService.CreatePrescriptionAsync(dtoWithTenant);
        return Ok(ApiResponse<object>.Ok(new { PrescriptionId = prescriptionId }));
    }

    [HttpPost("dispense")]
    public async Task<IActionResult> Dispense([FromBody] DispenseDrugDto dto)
    {
        await _pharmacyService.DispenseDrugAsync(dto);
        return Ok(ApiResponse<string>.Ok("Drug dispensed successfully."));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class BillingController : ControllerBase
{
    private readonly BillingService _billingService;

    public BillingController(BillingService billingService)
    {
        _billingService = billingService;
    }

    [HttpGet("invoices")]
    public async Task<IActionResult> GetInvoices()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var invoices = await _billingService.GetInvoicesAsync(tenantId);
        return Ok(ApiResponse<List<InvoiceDto>>.Ok(invoices));
    }

    [HttpPost("invoices")]
    public async Task<IActionResult> CreateInvoice([FromBody] CreateInvoiceDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        int invoiceId = await _billingService.CreateInvoiceAsync(dtoWithTenant);
        return Ok(ApiResponse<object>.Ok(new { InvoiceId = invoiceId }));
    }

    [HttpPost("payments")]
    public async Task<IActionResult> ProcessPayment([FromBody] ProcessPaymentDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        await _billingService.ProcessPaymentAsync(dtoWithTenant);
        return Ok(ApiResponse<string>.Ok("Payment processed successfully."));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly NotificationService _notificationService;

    public NotificationsController(NotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpPost("enqueue")]
    public async Task<IActionResult> Enqueue([FromBody] EnqueueNotificationDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        long id = await _notificationService.EnqueueNotificationAsync(dtoWithTenant);
        return Ok(ApiResponse<object>.Ok(new { NotificationId = id }));
    }
}
