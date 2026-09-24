import {
  createInboundTicket,
} from './src/services/inbound-ticket-create.service';

async function main() {
  console.log('');
  console.log('========================================');
  console.log('INBOUND TICKET CREATE TEST');
  console.log('========================================');
  console.log('');

  const ticket = await createInboundTicket({
    customerId: '9e09faf4-baa1-4ada-b14a-c3c35de789f4',
    macId: 'AA:BB:CC:DD:EE:FF',
    referenceNumber: 'TEST-CREATE-001',
    location: 'Delhi',
    office: 'Saket',
    issueDescription:
      'Test ticket created from inbound email processing.',
  });

  console.log('TICKET CREATED SUCCESSFULLY');
  console.log('');
  console.log(JSON.stringify(ticket, null, 2));
  console.log('');

  console.log('========================================');
  console.log('IMPORTANT');
  console.log('========================================');
  console.log('');
  console.log(`Ticket Number : ${ticket.ticket_number}`);
  console.log(`Status        : ${ticket.status}`);
  console.log(`Priority      : ${ticket.priority}`);
  console.log(`Customer ID   : ${ticket.customer_id}`);
  console.log(`MAC ID        : ${ticket.mac_id}`);
  console.log('');
}

main().catch((error) => {
  console.error('');
  console.error('Inbound ticket creation test failed:');
  console.error(error);
  process.exit(1);
});