import { authGateway } from "@/composition/authGateway";
import { identityProviders } from "@/composition/identityProviders";
import { createAuthHooks } from "@/hooks/createAuthHooks";

export const { useAuth } = createAuthHooks({ gateway: authGateway, providers: identityProviders });
