import { authGateway } from "@/composition/authGateway";
import { createAuthSessionHooks } from "@/hooks/createAuthSessionHooks";

export const { useSession } = createAuthSessionHooks(authGateway);
