import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { DetectionRepository } from '../repositories';
import { AppDataSource } from '../config/database';

export class ReportController {
  private detectionRepository: DetectionRepository;

  constructor() {
    this.detectionRepository = new DetectionRepository();
  }

  /**
   * Get attendance frequency report
   */
  getAttendanceFrequencyReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { eventIds } = req.query;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        res.status(400).json({
          success: false,
          message: 'Organization ID is required',
        });
        return;
      }

      // Build query conditions
      let eventCondition = '';
      const queryParams: any[] = [organizationId];

      if (eventIds) {
        // Handle multiple event IDs
        let eventIdArray: number[] = [];

        if (typeof eventIds === 'string') {
          // Single event ID or comma-separated string
          eventIdArray = eventIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        } else if (Array.isArray(eventIds)) {
          // Array of event IDs
          eventIdArray = eventIds.map(id => parseInt(id as string)).filter(id => !isNaN(id));
        }

        if (eventIdArray.length > 0) {
          const placeholders = eventIdArray.map(() => '?').join(',');
          eventCondition = ` AND d.event_id IN (${placeholders})`;
          queryParams.push(...eventIdArray);
        }
      }

      // Raw SQL query to get attendance frequency
      const query = `
        SELECT
          p.name as personName,
          p.id as personId,
          COUNT(*) as count
        FROM detections d
        INNER JOIN person_faces pf ON d.personface_id = pf.id
        INNER JOIN people p ON pf.person_id = p.id
        WHERE p.organization_id = ?
          AND d.status IN ('recognized', 'confirmed')
          AND d.personface_id IS NOT NULL
          ${eventCondition}
        GROUP BY p.id, p.name
        ORDER BY count DESC
      `;

      const result = await AppDataSource.query(query, queryParams);

      // Calculate percentages
      const totalDetections = result.reduce((sum: number, item: any) => sum + parseInt(item.count), 0);

      const attendanceData = result.map((item: any) => ({
        personName: item.personName,
        personId: parseInt(item.personId),
        count: parseInt(item.count),
        percentage: totalDetections > 0 ? (parseInt(item.count) / totalDetections) * 100 : 0,
      }));

      res.status(200).json({
        success: true,
        data: attendanceData,
        total: attendanceData.length,
        totalDetections,
      });
    } catch (error: any) {
      console.error('❌ Error generating attendance frequency report:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating attendance frequency report',
        error: error.message,
      });
    }
  };

  /**
   * Get event frequency report (how many unique participants attended each event)
   */
  getEventFrequencyReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { eventIds } = req.query;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        res.status(400).json({
          success: false,
          message: 'Organization ID is required',
        });
        return;
      }

      // Build query conditions
      let eventCondition = '';
      const queryParams: any[] = [organizationId];

      if (eventIds) {
        // Handle multiple event IDs
        let eventIdArray: number[] = [];

        if (typeof eventIds === 'string') {
          // Single event ID or comma-separated string
          eventIdArray = eventIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        } else if (Array.isArray(eventIds)) {
          // Array of event IDs
          eventIdArray = eventIds.map(id => parseInt(id as string)).filter(id => !isNaN(id));
        }

        if (eventIdArray.length > 0) {
          const placeholders = eventIdArray.map(() => '?').join(',');
          eventCondition = ` AND e.id IN (${placeholders})`;
          queryParams.push(...eventIdArray);
        }
      }

      // Raw SQL query to get event frequency (unique participants per event)
      const query = `
        SELECT
          e.name as eventName,
          e.id as eventId,
          COUNT(DISTINCT p.id) as count
        FROM events e
        LEFT JOIN detections d ON e.id = d.event_id
        LEFT JOIN person_faces pf ON d.personface_id = pf.id
        LEFT JOIN people p ON pf.person_id = p.id
        WHERE e.organization_id = ?
          AND d.status IN ('recognized', 'confirmed')
          AND d.personface_id IS NOT NULL
          ${eventCondition}
        GROUP BY e.id, e.name
        HAVING count > 0
        ORDER BY count DESC
      `;

      const result = await AppDataSource.query(query, queryParams);

      // Calculate percentages
      const totalParticipants = result.reduce((sum: number, item: any) => sum + parseInt(item.count), 0);

      const eventAttendanceData = result.map((item: any) => ({
        eventName: item.eventName,
        eventId: parseInt(item.eventId),
        count: parseInt(item.count),
        percentage: totalParticipants > 0 ? (parseInt(item.count) / totalParticipants) * 100 : 0,
      }));

      res.status(200).json({
        success: true,
        data: eventAttendanceData,
        total: eventAttendanceData.length,
        totalParticipants,
      });
    } catch (error: any) {
      console.error('❌ Error generating event frequency report:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating event frequency report',
        error: error.message,
      });
    }
  };
}