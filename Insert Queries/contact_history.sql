INSERT INTO ClientIQPreProd.dbo.contact_history
(

    customer_id,
    employee_id,
    contact_type,
    occurred_at,
    employee_name,
    summary,
    channel,
    outcome,
    created_at,
    updated_at
)
SELECT

    cust.customer_id                                     AS customer_id,
    emp.employee_id                                      AS employee_id,
    comms.CNTCT_TYPE_DESC                                AS contact_type,
    comms.CNTCT_OCCR_DT                                  AS occurred_at,
    comms.CNTCT_EMP_NM                                   AS employee_name,
    comms.CNTCT_SUMMARY                                  AS summary,
    comms.CNTCT_CHANNEL                                  AS channel,
    comms.CNTCT_OUTCOME                                  AS outcome,
    comms.CNTCT_CRTD_DT                                  AS created_at,
    comms.CNTCT_UPDTD_DT                                 AS updated_at
FROM TheSpotPreProd.dbo.CUST_COMMS_VIEW comms

/* Resolve customer */
JOIN ClientIQPreProd.dbo.customer cust
  ON cust.jack_henry_cif_number = comms.CIF_NBR

/* Resolve employee via FMB_ID → OFFFCR_CD → employee */
LEFT JOIN TheSpotPreProd.dbo.EMPL_VIEW ev
  ON ev.FMB_ID = comms.CNTCT_EMP_ID

LEFT JOIN ClientIQPreProd.dbo.employee emp
  ON emp.officer_code = ev.OFFFCR_CD;