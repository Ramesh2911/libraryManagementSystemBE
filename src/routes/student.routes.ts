import { Router } from 'express';
import { 
  registerStudent, 
  getStudents, 
  updateStudent, 
  deleteStudent 
} from '../controllers/student.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Depending on your requirements, Coordinator might also register students
router.post('/register', requireRole(['OWNER', 'COORDINATOR']), registerStudent);
router.get('/', requireRole(['OWNER', 'COORDINATOR']), getStudents);
router.patch('/:id', requireRole(['OWNER', 'COORDINATOR']), updateStudent);
router.delete('/:id', requireRole(['OWNER']), deleteStudent);

export default router;
