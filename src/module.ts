import { createExtension } from "@cognigy/extension-tools";

import { agentApiConnection } from "./connections/agentApiConnection";

import { requestSsoTokenNode } from "./nodes/requestSsoToken";
import { authSsoNode } from "./nodes/authSso";
import { authOtpStartNode } from "./nodes/authOtpStart";
import { authOtpVerifyNode } from "./nodes/authOtpVerify";
import { getUserNode } from "./nodes/getUser";
import { getStoresNode } from "./nodes/getStores";
import { getStoresMachinesStatusNode } from "./nodes/getStoresMachinesStatus";
import { getReceiptsNode } from "./nodes/getReceipts";
import { cancelSubscriptionNode } from "./nodes/cancelSubscription";
import { getSubscriptionUsersNode } from "./nodes/getSubscriptionUsers";
import { addSubscriptionUserNode } from "./nodes/addSubscriptionUser";
import { removeSubscriptionUserNode } from "./nodes/removeSubscriptionUser";
import { setPlateNumberNode } from "./nodes/setPlateNumber";
import { issueCouponNode } from "./nodes/issueCoupon";

export default createExtension({
  nodes: [
    requestSsoTokenNode,
    authSsoNode,
    authOtpStartNode,
    authOtpVerifyNode,
    getUserNode,
    getStoresNode,
    getStoresMachinesStatusNode,
    getReceiptsNode,
    cancelSubscriptionNode,
    getSubscriptionUsersNode,
    addSubscriptionUserNode,
    removeSubscriptionUserNode,
    setPlateNumberNode,
    issueCouponNode,
  ],
  connections: [agentApiConnection],
  options: { label: "Liquid Barcodes Agent" },
});
