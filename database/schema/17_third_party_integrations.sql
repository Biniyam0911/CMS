-- ============================================================
-- 17 - Third Party Integrations Schema
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE IntegrationConfigs (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    ProviderCode    VARCHAR(50)     NOT NULL, -- 'SMTP', 'SENDGRID', 'TWILIO', 'AFRICASTALKING', 'INFOBIP', 'STRIPE', 'PAYPAL', 'CHAPA', 'OPENAI', 'HL7_TCP', 'ASTM_TCP'
    ProviderType    VARCHAR(50)     NOT NULL, -- 'Email', 'SMS', 'Payment', 'LabInstrument', 'AI', 'Insurance'
    DisplayName     NVARCHAR(100)   NOT NULL,
    IsEnabled       BIT             NOT NULL DEFAULT 0,
    CredentialsJson NVARCHAR(MAX)   NULL, -- Encrypted or JSON settings (ApiKey, Host, Port, Secrets)
    IsPrimary       BIT             NOT NULL DEFAULT 0,
    LastHealthCheck DATETIME2       NULL,
    HealthStatus    VARCHAR(20)     NOT NULL DEFAULT 'Unknown', -- 'Healthy', 'Degraded', 'Error', 'Unknown'
    ErrorMessage    NVARCHAR(500)   NULL,
    UpdatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedBy       INT             NULL,
    CONSTRAINT PK_IntegrationConfigs PRIMARY KEY (Id),
    CONSTRAINT UQ_IntegrationConfigs UNIQUE (TenantId, ProviderCode),
    CONSTRAINT FK_IntegrationConfigs_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);
GO

-- Seed supported integration presets
INSERT INTO IntegrationConfigs (TenantId, ProviderCode, ProviderType, DisplayName, IsEnabled, IsPrimary, HealthStatus) VALUES
(1, 'SMTP', 'Email', 'Standard SMTP Mailer', 1, 1, 'Healthy'),
(1, 'SENDGRID', 'Email', 'Twilio SendGrid API', 0, 0, 'Unknown'),
(1, 'TWILIO', 'SMS', 'Twilio SMS Gateway', 0, 0, 'Unknown'),
(1, 'AFRICASTALKING', 'SMS', 'Africa''s Talking SMS Gateway', 1, 1, 'Healthy'),
(1, 'CHAPA', 'Payment', 'Chapa Payment Gateway', 0, 0, 'Unknown'),
(1, 'STRIPE', 'Payment', 'Stripe Online Payments', 0, 0, 'Unknown'),
(1, 'HL7_TCP', 'LabInstrument', 'HL7 MLLP Analyzer Feeds (Port 2575)', 1, 1, 'Healthy'),
(1, 'ASTM_TCP', 'LabInstrument', 'ASTM E1381 Analyzer Feeds (Port 2576)', 1, 1, 'Healthy'),
(1, 'OPENAI', 'AI', 'OpenAI Clinical Assistant & Summarizer', 0, 0, 'Unknown');
GO
