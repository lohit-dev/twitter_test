export const queries = {
  totalOrdersQuery: `
SELECT 
  COUNT(create_order_id) as total_orders,
  COUNT(CASE WHEN s1.redeem_tx_hash != '' AND s2.redeem_tx_hash != '' THEN 1 END) as fulfilled_orders,
  COUNT(CASE WHEN s1.refund_tx_hash != '' THEN 1 END) as refunded_orders,
  COUNT(CASE WHEN s1.redeem_tx_hash = '' AND s2.redeem_tx_hash = '' AND s1.refund_tx_hash = '' THEN 1 END) as expired_orders,
  DATE_PART('day', NOW() - MIN(mo.created_at)) as days_since_start,
  MIN(mo.created_at) as start_date
FROM matched_orders mo
INNER JOIN swaps s1 ON s1.swap_id = mo.source_swap_id
INNER JOIN swaps s2 ON s2.swap_id = mo.destination_swap_id;
`,
  yesterdayOrdersQuery: `
SELECT 
  COUNT(create_order_id) as total_orders,
  COUNT(CASE WHEN s1.redeem_tx_hash != '' AND s2.redeem_tx_hash != '' THEN 1 END) as fulfilled_orders,
  COUNT(CASE WHEN s1.refund_tx_hash != '' THEN 1 END) as refunded_orders,
  COUNT(CASE WHEN s1.redeem_tx_hash = '' AND s2.redeem_tx_hash = '' AND s1.refund_tx_hash = '' THEN 1 END) as expired_orders
FROM matched_orders mo
INNER JOIN swaps s1 ON s1.swap_id = mo.source_swap_id
INNER JOIN swaps s2 ON s2.swap_id = mo.destination_swap_id
WHERE mo.created_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '24 HOURS'
  AND mo.created_at <= NOW() AT TIME ZONE 'UTC'
`,
  volumeQuery: `
SELECT 
    mo.create_order_id,
    s1.amount as source_swap_amount,
    s2.amount as destination_swap_amount,
    s1.redeem_tx_hash as source_swap_tx_hash,
    s2.redeem_tx_hash as destination_swap_tx_hash,
    co.source_chain as source_chain,
    co.source_asset as source_asset,
    co.destination_chain as destination_chain,
    co.destination_asset as destination_asset,
    (co.additional_data->>'input_token_price')::float as input_token_price,
    (co.additional_data->>'output_token_price')::float as output_token_price,
    mo.created_at AT TIME ZONE 'UTC' as created_at
FROM matched_orders mo
INNER JOIN create_orders co ON co.create_id = mo.create_order_id
INNER JOIN swaps s1 ON s1.swap_id = mo.source_swap_id
INNER JOIN swaps s2 ON s2.swap_id = mo.destination_swap_id
WHERE s1.redeem_tx_hash != ''
    AND s2.redeem_tx_hash != ''
    AND co.create_id IS NOT NULL
ORDER BY mo.created_at DESC;
`,
  yesterDayVolumeQuery: `
SELECT 
    mo.create_order_id,
    s1.amount as source_swap_amount,
    s2.amount as destination_swap_amount,
    s1.redeem_tx_hash as source_swap_tx_hash,
    s2.redeem_tx_hash as destination_swap_tx_hash,
    co.source_chain as source_chain,
    co.source_asset as source_asset,
    co.destination_asset as destination_asset,
    (co.additional_data->>'input_token_price')::float as input_token_price,
    (co.additional_data->>'output_token_price')::float as output_token_price,
    mo.created_at AT TIME ZONE 'UTC' as created_at
FROM matched_orders mo
INNER JOIN create_orders co ON co.create_id = mo.create_order_id
INNER JOIN swaps s1 ON s1.swap_id = mo.source_swap_id
INNER JOIN swaps s2 ON s2.swap_id = mo.destination_swap_id
WHERE mo.created_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '24 HOURS'
    AND s1.redeem_tx_hash != ''
    AND s2.redeem_tx_hash != ''
    AND co.create_id IS NOT NULL
ORDER BY mo.created_at DESC;
`,

  dailyActiveUsers: `
SELECT COUNT(DISTINCT co.initiator_source_address) as active_users
FROM create_orders co
INNER JOIN matched_orders mo ON mo.create_order_id = co.create_id
WHERE mo.created_at >= DATE_TRUNC('day', NOW() - INTERVAL '1 day')
AND mo.created_at < DATE_TRUNC('day', NOW());
`,

  newUsersToday: `
SELECT COUNT(DISTINCT new_users.initiator_source_address) as new_users
FROM (
    SELECT initiator_source_address, MIN(created_at) as first_swap
    FROM create_orders
    GROUP BY initiator_source_address
) new_users
WHERE new_users.first_swap >= DATE_TRUNC('day', NOW() - INTERVAL '1 day')
AND new_users.first_swap < DATE_TRUNC('day', NOW());
`,

  users: `
SELECT COUNT(DISTINCT(co.initiator_source_address)) as total_users
        FROM matched_orders mo
        INNER JOIN create_orders co ON co.create_id = mo.create_order_id
        INNER JOIN swaps s1 ON s1.swap_id = mo.source_swap_id
        INNER JOIN swaps s2 ON s2.swap_id = mo.destination_swap_id
        AND s1.redeem_tx_hash!= '' AND s2.redeem_tx_hash!= ''
  `,
};
