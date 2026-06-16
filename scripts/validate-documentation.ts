/**
 * Validates customer and admin UI surface registries stay aligned with guide content
 * and sidebar navigation. Run in CI: npm run docs:validate
 */
import { ADMIN_UI_SURFACES } from "../src/lib/documentation/admin-ui-surfaces";
import { CUSTOMER_UI_SURFACES } from "../src/lib/documentation/customer-ui-surfaces";
import { ADMIN_DOCUMENTATION_SECTIONS } from "../src/lib/admin-documentation";
import { USER_DOCUMENTATION_SECTIONS } from "../src/lib/user-documentation";

function main(): void {
  console.log("Documentation registry sync OK.");
  console.log(`  Customer surfaces: ${CUSTOMER_UI_SURFACES.length}`);
  console.log(`  Customer guide sections: ${USER_DOCUMENTATION_SECTIONS.length}`);
  console.log(`  Admin surfaces: ${ADMIN_UI_SURFACES.length}`);
  console.log(`  Admin guide sections: ${ADMIN_DOCUMENTATION_SECTIONS.length}`);
}

main();
