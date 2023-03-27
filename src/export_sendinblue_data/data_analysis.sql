SELECT
	contactId,
	date(campaigns.sentDate, 'start of month') as month,
	count(*) as total,
	case
		when (count(*) >= 1) then 1
		else 0
	end as open_1,
	case
		when (count(*) >= 5) then 1
		else 0
	end as open_5
FROM
	events
LEFT JOIN campaigns ON
	events.campaignId = campaigns.id
WHERE
	events."type" = 'opened'
	AND campaigns.sentDate >= "2022-01-01"
	AND campaigns.sentDate <= "2023-03-12"
GROUP BY
	contactId,
	date(campaigns.sentDate, 'start of month')
ORDER BY
	contactId,
	month;




SELECT
	contactId,
	sum(open_at_least_1_per_month),
	sum(open_at_least_5_per_month)
FROM
	(
	SELECT
		contactId,
		date(campaigns.sentDate, 'start of month') as month,
		count(*) as total,
		case
			when (count(*) >= 1) then 1
			else 0
		end as open_at_least_1_per_month,
		case
			when (count(*) >= 5) then 1
			else 0
		end as open_at_least_5_per_month
	FROM
		events
	LEFT JOIN campaigns ON
		events.campaignId = campaigns.id
	WHERE
		events."type" = 'opened'
		AND campaigns.sentDate >= "2022-01-01"
		AND campaigns.sentDate <= "2022-12-31"
	GROUP BY
		contactId,
		date(campaigns.sentDate, 'start of month')
	ORDER BY
		contactId,
		month)
GROUP BY
	contactId;


SELECT
	type_mailing,
	count(*) as nb_contacts_who_opened_at_least_one_NL_in_the_year,
	sum(open_at_least_1_per_month_each_month) as nb_contacts_who_opened_at_least_one_NL_each_month,
	sum(open_at_least_5_per_month_each_month) as nb_contacts_who_opened_at_least_5_NL_each_month
from
	(
	SELECT
		contactId,
		case
			when (sum(open_at_least_1_per_month) = 12) then 1
			else 0
		end as open_at_least_1_per_month_each_month,
		case
			when (sum(open_at_least_5_per_month) = 12) then 1
			else 0
		end as open_at_least_5_per_month_each_month,
		type_mailing
	FROM
		(
		SELECT
			contactId,
			date(campaigns.sentDate, 'start of month') as month,
			count(*) as total,
			case
				when (count(*) >= 1) then 1
				else 0
			end as open_at_least_1_per_month,
			case
				when (count(*) >= 5) then 1
				else 0
			end as open_at_least_5_per_month,
			case
				when (campaigns.subject LIKE "%contact.VILLE%") then "VILLE"
				else "ACTU"
			end as type_mailing
		FROM
			events
		LEFT JOIN campaigns ON
			events.campaignId = campaigns.id
		WHERE
			events."type" = 'opened'
			AND campaigns.sentDate >= "2022-01-01"
			AND campaigns.sentDate <= "2022-12-31"
		GROUP BY 
			contactId,
			date(campaigns.sentDate, 'start of month'),
			type_mailing
		ORDER BY
			contactId,
			month)
	GROUP BY
		contactId,
		type_mailing)
GROUP BY
	type_mailing;

SELECT
	count(distinct(contactId)) as nb_contacts_who_received_at_least_one_NL_in_the_year,
	case
		when (campaigns.subject LIKE "%contact.VILLE%") then "VILLE"
		else "ACTU"
	end as type_mailing
FROM
	events
LEFT JOIN campaigns ON
	events.campaignId = campaigns.id
WHERE
	events."type" = 'delivered'
	AND campaigns.sentDate >= "2022-01-01"
	AND campaigns.sentDate <= "2022-12-31"
GROUP BY
	type_mailing;
